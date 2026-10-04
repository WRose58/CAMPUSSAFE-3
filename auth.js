import { auth, db } from "./firebase-config.js";

import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";


// Get registration form
const registerForm = document.getElementById("registerForm");


if (registerForm) {

    registerForm.addEventListener("submit", async function(event) {

        event.preventDefault();


        // Get form values
        const name = document.getElementById("name").value.trim();

        const email = document.getElementById("email").value.trim();

        const password = document.getElementById("password").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;

        const role = document.getElementById("role").value;


        // Check passwords
        if (password !== confirmPassword) {

            alert("Passwords do not match.");

            return;
        }


        try {

            // Create Firebase account
            const userCredential =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


            const user = userCredential.user;


            // Save user information in Firestore
            await setDoc(
                doc(db, "users", user.uid),
                {
                    name: name,
                    email: email,
                    role: role,
                    createdAt: new Date()
                }
            );


            alert("Account created successfully!");


            // Redirect to login
            window.location.href = "login.html";


        } catch (error) {

            console.error(error);

            alert("Registration failed: " + error.message);

        }

    });

}