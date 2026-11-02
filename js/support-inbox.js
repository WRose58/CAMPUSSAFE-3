import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    addDoc,
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { readDemoThreads, writeDemoThreads } from "./support-chat.js";

const DEMO_THREADS_KEY = "campusSafeSupportThreads";

const toDate = (value) => {
    if (value?.toDate) return value.toDate();
    if (value instanceof Date) return value;
    return new Date(value || Date.now());
};

const formatTime = (value) => toDate(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
});

export function initializeSupportInbox(user) {
    const list = document.getElementById("supportThreadList");
    const conversation = document.getElementById("supportConversation");
    const form = document.getElementById("supportReplyForm");
    const input = document.getElementById("supportReplyInput");
    const title = document.getElementById("supportConversationTitle");
    const status = document.getElementById("supportStatus");
    const sendButton = form?.querySelector("button[type=submit]");
    if (!user || !list || !conversation || !form || !input || !title || !status) return;

    let firebaseReady = false;
    let remoteMode = false;
    let threads = [];
    let selectedId = "";
    let unsubscribeThreads;
    let unsubscribeMessages;

    const renderConversation = (thread, threadMessages) => {
        title.textContent = thread ? `${thread.userName || "Student"} · ${thread.userEmail || ""}` : "Select a conversation";
        conversation.replaceChildren();
        if (!thread) {
            const empty = document.createElement("p");
            empty.className = "support-empty-state";
            empty.textContent = "Choose a conversation to view messages.";
            conversation.append(empty);
            return;
        }
        if (Number.isInteger(Number(thread.rating)) && Number(thread.rating) >= 1 && Number(thread.rating) <= 5) {
            const rating = document.createElement("aside");
            rating.className = "support-rating-summary";
            const heading = document.createElement("strong");
            heading.textContent = `Student rating: ${thread.rating}/5`;
            rating.append(heading);
            if (thread.feedbackCategory) {
                const category = document.createElement("p");
                category.className = "support-feedback-category";
                category.textContent = thread.feedbackCategory;
                rating.append(category);
            }
            if (thread.feedback) {
                const feedback = document.createElement("p");
                feedback.textContent = thread.feedback;
                rating.append(feedback);
            }
            conversation.append(rating);
        }
        if (!threadMessages.length) {
            const empty = document.createElement("p");
            empty.className = "support-empty-state";
            empty.textContent = "No messages in this conversation yet.";
            conversation.append(empty);
            return;
        }

        threadMessages.forEach((message) => {
            const bubble = document.createElement("div");
            bubble.className = `chat-message ${message.senderRole === "security" ? "outgoing" : "incoming"}`;
            bubble.textContent = message.text;
            const byline = document.createElement("small");
            byline.className = "support-message-byline";
            byline.textContent = `${message.senderRole === "security" ? "Campus Security" : message.senderName || "Student"} · ${formatTime(message.createdAt)}`;
            bubble.append(byline);
            conversation.append(bubble);
        });
        conversation.scrollTop = conversation.scrollHeight;
    };

    const selectedThread = () => threads.find((thread) => thread.id === selectedId) || null;

    const renderThreadList = () => {
        list.replaceChildren();
        if (!threads.length) {
            const empty = document.createElement("p");
            empty.className = "support-empty-state px-3";
            empty.textContent = "No support conversations yet.";
            list.append(empty);
            selectedId = "";
            unsubscribeMessages?.();
            renderConversation(null, []);
            return;
        }

        threads.forEach((thread) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `support-thread${thread.id === selectedId ? " active" : ""}`;
            const name = document.createElement("strong");
            name.textContent = thread.userName || "Student";
            const email = document.createElement("small");
            email.textContent = thread.userEmail || "";
            const preview = document.createElement("span");
            preview.textContent = thread.lastMessage || thread.messages?.at(-1)?.text || "New conversation";
            const time = document.createElement("time");
            time.textContent = formatTime(thread.updatedAt);
            button.append(name, email, preview, time);
            button.addEventListener("click", () => selectThread(thread.id));
            list.append(button);
        });

        if (!threads.some((thread) => thread.id === selectedId)) selectThread(threads[0].id);
    };

    const selectThread = (threadId) => {
        selectedId = threadId;
        const thread = selectedThread();
        list.querySelectorAll(".support-thread").forEach((button) => {
            button.classList.toggle("active", button.querySelector("strong")?.textContent === thread?.userName);
        });
        unsubscribeMessages?.();
        if (!thread) {
            renderConversation(null, []);
            return;
        }

        if (remoteMode) {
            const messagesQuery = query(
                collection(db, "supportThreads", thread.id, "messages"),
                orderBy("createdAt", "asc")
            );
            unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
                renderConversation(thread, snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
            }, (error) => {
                console.error("Support conversation load error:", error);
                status.textContent = "Could not load conversation messages. Check database permissions.";
            });
        } else {
            renderConversation(thread, thread.messages || []);
        }
    };

    const renderDemoThreads = () => {
        threads = readDemoThreads().sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
        renderThreadList();
        if (selectedId) {
            const thread = selectedThread();
            if (thread) renderConversation(thread, thread.messages || []);
        }
    };

    onAuthStateChanged(auth, (firebaseUser) => {
        firebaseReady = true;
        remoteMode = firebaseUser?.uid === user.uid;
        unsubscribeThreads?.();
        unsubscribeMessages?.();

        if (remoteMode) {
            status.textContent = "Live support inbox";
            const threadsQuery = query(collection(db, "supportThreads"), orderBy("updatedAt", "desc"));
            unsubscribeThreads = onSnapshot(threadsQuery, (snapshot) => {
                threads = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
                renderThreadList();
            }, (error) => {
                console.error("Support inbox load error:", error);
                status.textContent = "Could not load the support inbox. Check Firestore access rules.";
            });
        } else {
            status.textContent = "Demo inbox: shared on this browser only";
            renderDemoThreads();
        }
    });

    window.addEventListener("storage", (event) => {
        if (!remoteMode && event.key === DEMO_THREADS_KEY) renderDemoThreads();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const text = input.value.trim();
        const thread = selectedThread();
        if (!text || !thread) return;
        if (!firebaseReady) {
            status.textContent = "Connecting to the support inbox...";
            return;
        }

        sendButton.disabled = true;
        try {
            if (remoteMode) {
                const threadRef = doc(db, "supportThreads", thread.id);
                await updateDoc(threadRef, {
                    updatedAt: serverTimestamp(),
                    lastMessage: text,
                    lastSenderRole: "security"
                });
                await addDoc(collection(threadRef, "messages"), {
                    senderId: user.uid,
                    senderName: user.name || "Campus Security",
                    senderRole: "security",
                    text,
                    createdAt: serverTimestamp()
                });
            } else {
                const demoThreads = readDemoThreads();
                const demoThread = demoThreads.find((item) => item.id === thread.id);
                if (!demoThread) return;
                demoThread.updatedAt = Date.now();
                demoThread.lastMessage = text;
                demoThread.lastSenderRole = "security";
                demoThread.messages.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    senderId: user.uid,
                    senderName: user.name || "Campus Security",
                    senderRole: "security",
                    text,
                    createdAt: Date.now()
                });
                writeDemoThreads(demoThreads);
                renderDemoThreads();
            }
            input.value = "";
            input.focus();
        } catch (error) {
            console.error("Support reply send error:", error);
            status.textContent = "Reply could not be sent. Check your connection and database permissions.";
        } finally {
            sendButton.disabled = false;
        }
    });
}
