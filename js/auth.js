import { auth, db } from "./firebase-config.js";

import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


const registerForm = document.getElementById("registerForm");


if (registerForm) {

    registerForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const name =
            document.getElementById("name").value.trim();

        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;

        const role =
            document.getElementById("role").value;


        if (password !== confirmPassword) {

            alert("Passwords do not match.");

            return;
        }


        try {

            console.log("Creating Firebase account...");

            const userCredential =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


            const user = userCredential.user;

            console.log("Firebase account created:", user.uid);


            await setDoc(
                doc(db, "users", user.uid),
                {
                    name: name,
                    email: email,
                    role: role,
                    createdAt: new Date()
                }
            );


            console.log("User saved to Firestore.");

            alert("Account created successfully!");

            window.location.href = "login.html";


        } catch (error) {

            console.error("Registration error:", error);

            alert(
                "Registration failed:\n\n" +
                error.code +
                "\n\n" +
                error.message
            );

        }

        // ===============================
// LOGIN FUNCTIONALITY
// ===============================

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const email =
            document.getElementById("loginEmail").value.trim();

        const password =
            document.getElementById("loginPassword").value;


        if (!email || !password) {

            alert("Please enter your email and password.");

            return;
        }


        try {

            console.log("Logging in...");


            // Sign in using Firebase Authentication
            const userCredential =
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


            const user = userCredential.user;


            console.log("Login successful:", user.uid);


            // Get the user's information from Firestore
            const userDocument =
                await getDoc(
                    doc(db, "users", user.uid)
                );


            if (!userDocument.exists()) {

                alert(
                    "Your account information could not be found."
                );

                return;
            }


            const userData = userDocument.data();


            console.log("User role:", userData.role);


            // Redirect based on role
            if (userData.role === "security") {

                window.location.href =
                    "admin/dashboard.html";

            } else {

                window.location.href =
                    "dashboard.html";

            }


        } catch (error) {

            console.error("Login error:", error);

            alert(
                "Login failed:\n\n" +
                error.code +
                "\n\n" +
                error.message
            );

        }

    });

}

    });

}