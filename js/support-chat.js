import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const DEMO_THREADS_KEY = "campusSafeSupportThreads";

export const readDemoThreads = () => {
    try {
        return JSON.parse(localStorage.getItem(DEMO_THREADS_KEY) || "[]");
    } catch {
        return [];
    }
};

export const writeDemoThreads = (threads) => {
    localStorage.setItem(DEMO_THREADS_KEY, JSON.stringify(threads));
};

const toDate = (value) => {
    if (value?.toDate) return value.toDate();
    if (value instanceof Date) return value;
    return new Date(value || Date.now());
};

const addMessage = (container, message) => {
    const bubble = document.createElement("div");
    bubble.className = `chat-message ${message.senderRole === "student" ? "outgoing" : "incoming"}`;
    bubble.textContent = message.text;

    const time = document.createElement("time");
    time.className = "chat-message-time";
    time.dateTime = toDate(message.createdAt).toISOString();
    time.textContent = toDate(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    bubble.append(time);
    container.append(bubble);
};

const renderMessages = (container, messages) => {
    container.replaceChildren();
    if (!messages.length) {
        const empty = document.createElement("p");
        empty.className = "chat-empty";
        empty.textContent = "Send a message to start a conversation with Campus Security.";
        container.append(empty);
        return;
    }

    messages.forEach((message) => addMessage(container, message));
    container.parentElement.scrollTop = container.parentElement.scrollHeight;
};

export function initializeStudentSupport(user) {
    const form = document.getElementById("chatForm");
    const input = document.getElementById("chatInput");
    const messages = document.getElementById("chatMessages");
    const status = document.getElementById("chatStatus");
    const ratingForm = document.getElementById("chatRatingForm");
    const ratingStatus = document.getElementById("chatRatingStatus");
    if (!user || !form || !input || !messages || !status) return;

    let firebaseReady = false;
    let remoteMode = false;
    let unsubscribeMessages;
    let currentMessages = [];

    const renderLocalMessages = () => {
        const thread = readDemoThreads().find((item) => item.id === user.uid);
        currentMessages = thread?.messages || [];
        renderMessages(messages, currentMessages);
    };

    const restoreRating = (thread = {}) => {
        const selectedRating = ratingForm?.querySelector(`input[name="supportRating"][value="${thread.rating || ""}"]`);
        if (selectedRating) selectedRating.checked = true;
        const feedbackInput = ratingForm?.querySelector("[name=feedback]");
        if (feedbackInput) feedbackInput.value = thread.feedback || "";
        const submitButton = ratingForm?.querySelector("button[type=submit]");
        if (submitButton) submitButton.textContent = thread.rating ? "Update rating" : "Submit rating";
        if (ratingStatus) ratingStatus.textContent = thread.rating ? "Your rating has been saved." : "";
    };

    onAuthStateChanged(auth, (firebaseUser) => {
        firebaseReady = true;
        remoteMode = firebaseUser?.uid === user.uid;
        unsubscribeMessages?.();

        if (remoteMode) {
            status.textContent = "Connected to Campus Support";
            getDoc(doc(db, "supportThreads", user.uid)).then((snapshot) => {
                restoreRating(snapshot.exists() ? snapshot.data() : {});
            }).catch((error) => console.error("Support rating load error:", error));
            const messagesQuery = query(
                collection(db, "supportThreads", user.uid, "messages"),
                orderBy("createdAt", "asc")
            );
            unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
                currentMessages = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
                renderMessages(messages, currentMessages);
            }, (error) => {
                console.error("Support chat load error:", error);
                status.textContent = "Could not load messages. Check your support database permissions.";
            });
        } else {
            status.textContent = "Demo mode: messages are shared on this browser only.";
            renderLocalMessages();
            restoreRating(readDemoThreads().find((item) => item.id === user.uid) || {});
        }
    });

    window.addEventListener("storage", (event) => {
        if (!remoteMode && event.key === DEMO_THREADS_KEY) renderLocalMessages();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        if (!firebaseReady) {
            status.textContent = "Connecting to Campus Support...";
            return;
        }

        const sendButton = form.querySelector("button[type=submit]");
        sendButton.disabled = true;
        try {
            if (remoteMode) {
                const threadRef = doc(db, "supportThreads", user.uid);
                await setDoc(threadRef, {
                    userId: user.uid,
                    userName: user.name || "Student",
                    userEmail: user.email || "",
                    status: "open",
                    lastMessage: text,
                    lastSenderRole: "student",
                    updatedAt: serverTimestamp()
                }, { merge: true });
                await addDoc(collection(threadRef, "messages"), {
                    senderId: user.uid,
                    senderName: user.name || "Student",
                    senderRole: "student",
                    text,
                    createdAt: serverTimestamp()
                });
            } else {
                const threads = readDemoThreads();
                let thread = threads.find((item) => item.id === user.uid);
                if (!thread) {
                    thread = { id: user.uid, userId: user.uid, userName: user.name || "Student", userEmail: user.email || "", messages: [] };
                    threads.unshift(thread);
                }
                thread.updatedAt = Date.now();
                thread.status = "open";
                thread.messages.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    senderId: user.uid,
                    senderName: user.name || "Student",
                    senderRole: "student",
                    text,
                    createdAt: Date.now()
                });
                writeDemoThreads(threads);
                renderLocalMessages();
            }
            input.value = "";
            input.focus();
        } catch (error) {
            console.error("Support message send error:", error);
            status.textContent = "Message could not be sent. Check your connection and database permissions.";
        } finally {
            sendButton.disabled = false;
        }
    });

    ratingForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(ratingForm);
        const rating = Number(formData.get("supportRating"));
        const feedback = String(formData.get("feedback") || "").trim();
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
        if (!firebaseReady) {
            ratingStatus.textContent = "Connecting to Campus Support...";
            return;
        }

        const submitButton = ratingForm.querySelector("button[type=submit]");
        submitButton.disabled = true;
        try {
            if (remoteMode) {
                await setDoc(doc(db, "supportThreads", user.uid), {
                    userId: user.uid,
                    userName: user.name || "Student",
                    userEmail: user.email || "",
                    status: "open",
                    rating,
                    feedback,
                    updatedAt: serverTimestamp(),
                    ratedAt: serverTimestamp()
                }, { merge: true });
            } else {
                const threads = readDemoThreads();
                let thread = threads.find((item) => item.id === user.uid);
                if (!thread) {
                    thread = { id: user.uid, userId: user.uid, userName: user.name || "Student", userEmail: user.email || "", messages: [] };
                    threads.unshift(thread);
                }
                thread.rating = rating;
                thread.feedback = feedback;
                thread.ratedAt = Date.now();
                thread.updatedAt = Date.now();
                thread.status = "open";
                writeDemoThreads(threads);
            }
            ratingStatus.textContent = "Thanks. Your rating has been saved.";
            submitButton.textContent = "Update rating";
        } catch (error) {
            console.error("Support rating save error:", error);
            ratingStatus.textContent = "Rating could not be saved. Check your connection and database permissions.";
        } finally {
            submitButton.disabled = false;
        }
    });
}
