import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { readDemoThreads, writeDemoThreads } from "./support-chat.js";

const user = JSON.parse(localStorage.getItem("campusSafeUser") || "null");
const form = document.getElementById("feedbackForm");
const status = document.getElementById("feedbackStatus");
const submitButton = document.getElementById("feedbackSubmit");
const messageInput = document.getElementById("feedbackMessage");
const characterCount = document.getElementById("feedbackCharacterCount");

if (!user) {
    window.location.href = "login.html";
} else if (user.role === "security" || user.role === "administration") {
    window.location.href = "admin/dashboard.html";
} else {
    let firebaseReady = false;
    let remoteMode = false;

    const restoreFeedback = (thread = {}) => {
        const ratingInput = form.querySelector(`input[name="supportRating"][value="${thread.rating || ""}"]`);
        if (ratingInput) ratingInput.checked = true;
        if (thread.feedbackCategory) {
            form.elements.category.value = thread.feedbackCategory;
        }
        messageInput.value = thread.feedback || "";
        characterCount.textContent = String(messageInput.value.length);
        submitButton.innerHTML = thread.rating
            ? '<i class="fa-solid fa-rotate"></i> Update feedback'
            : '<i class="fa-solid fa-paper-plane"></i> Submit feedback';
        status.textContent = thread.rating ? "Your previous feedback is loaded. You can update it below." : "";
    };

    messageInput.addEventListener("input", () => {
        characterCount.textContent = String(messageInput.value.length);
    });

    onAuthStateChanged(auth, async (firebaseUser) => {
        firebaseReady = true;
        remoteMode = firebaseUser?.uid === user.uid;
        submitButton.disabled = false;

        if (remoteMode) {
            try {
                const snapshot = await getDoc(doc(db, "supportThreads", user.uid));
                restoreFeedback(snapshot.exists() ? snapshot.data() : {});
            } catch (error) {
                console.error("Feedback load error:", error);
                status.textContent = "Could not load your saved feedback. You can still submit an update.";
            }
        } else {
            restoreFeedback(readDemoThreads().find((thread) => thread.id === user.uid) || {});
            status.textContent = readDemoThreads().some((thread) => thread.id === user.uid && thread.rating)
                ? "Your previous feedback is loaded. You can update it below."
                : "Demo mode: feedback is saved on this browser only.";
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const rating = Number(formData.get("supportRating"));
        const category = String(formData.get("category") || "");
        const feedback = String(formData.get("feedback") || "").trim();
        if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !category) return;
        if (!firebaseReady) {
            status.textContent = "Connecting to CampusSafe...";
            return;
        }

        submitButton.disabled = true;
        status.textContent = "Saving your feedback...";
        try {
            if (remoteMode) {
                await setDoc(doc(db, "supportThreads", user.uid), {
                    userId: user.uid,
                    userName: user.name || "Student",
                    userEmail: user.email || "",
                    status: "open",
                    rating,
                    feedback,
                    feedbackCategory: category,
                    updatedAt: serverTimestamp(),
                    ratedAt: serverTimestamp()
                }, { merge: true });
            } else {
                const threads = readDemoThreads();
                let thread = threads.find((item) => item.id === user.uid);
                if (!thread) {
                    thread = {
                        id: user.uid,
                        userId: user.uid,
                        userName: user.name || "Student",
                        userEmail: user.email || "",
                        messages: []
                    };
                    threads.unshift(thread);
                }
                thread.rating = rating;
                thread.feedback = feedback;
                thread.feedbackCategory = category;
                thread.ratedAt = Date.now();
                thread.updatedAt = Date.now();
                thread.status = "open";
                writeDemoThreads(threads);
            }

            status.textContent = "Thank you. Your feedback has been saved.";
            submitButton.innerHTML = '<i class="fa-solid fa-rotate"></i> Update feedback';
        } catch (error) {
            console.error("Feedback save error:", error);
            status.textContent = "Feedback could not be saved. Check your connection and database permissions.";
        } finally {
            submitButton.disabled = false;
        }
    });
}