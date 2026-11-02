import { auth, db } from "../firebase-config.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const showMessage = (message, type = "danger") => {
    const alertBox = document.getElementById("formMessage");

    if (!alertBox) {
        alert(message);
        return;
    }

    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    alertBox.hidden = false;
};

const saveSession = (userData) => {
    localStorage.setItem("campusSafeUser", JSON.stringify(userData));
};

const clearSession = () => {
    localStorage.removeItem("campusSafeUser");
};

const loadUser = () => JSON.parse(localStorage.getItem("campusSafeUser") || "null");

const DEMO_USERS = {
    "student@campus.edu": { name: "Student User", password: "student123", role: "student" },
    "security@campus.edu": { name: "Security Officer", password: "security123", role: "security" }
};

const getStoredAccounts = () => JSON.parse(localStorage.getItem("campusSafeAccounts") || "{}");

const ensureDemoAccounts = () => {
    const saved = getStoredAccounts();
    Object.entries(DEMO_USERS).forEach(([email, user]) => {
        if (!saved[email]) {
            saved[email] = { ...user, email };
        }
    });
    localStorage.setItem("campusSafeAccounts", JSON.stringify(saved));
};

const attemptDemoLogin = (email, password) => {
    ensureDemoAccounts();
    const account = getStoredAccounts()[email.trim().toLowerCase()];

    if (!account || account.password !== password) {
        return null;
    }

    return {
        uid: `demo-${email.trim().toLowerCase().replace(/[^a-z0-9]/g, "")}`,
        name: account.name,
        email: email.trim().toLowerCase(),
        role: account.role
    };
};

const registerDemoUser = (name, email, password, role) => {
    ensureDemoAccounts();
    const saved = getStoredAccounts();
    const normalizedEmail = email.trim().toLowerCase();

    if (saved[normalizedEmail]) {
        throw new Error("An account with this email already exists.");
    }

    saved[normalizedEmail] = {
        name,
        email: normalizedEmail,
        password,
        role
    };

    localStorage.setItem("campusSafeAccounts", JSON.stringify(saved));

    return {
        uid: `demo-${normalizedEmail.replace(/[^a-z0-9]/g, "")}`,
        name,
        email: normalizedEmail,
        role
    };
};

const saveProfileData = (data) => {
    const user = loadUser();
    if (!user) return;
    const updated = { ...user, ...data };
    localStorage.setItem("campusSafeUser", JSON.stringify(updated));
};

const saveReports = (reports) => localStorage.setItem("campusSafeReports", JSON.stringify(reports));
const loadReports = () => JSON.parse(localStorage.getItem("campusSafeReports") || "[]");

const saveLostItems = (items) => localStorage.setItem("campusSafeLostItems", JSON.stringify(items));
const loadLostItems = () => JSON.parse(localStorage.getItem("campusSafeLostItems") || "[]");

const readPhoto = (fileInput) => {
    const file = fileInput?.files?.[0];
    if (!file) return Promise.resolve("");
    if (!file.type.startsWith("image/")) return Promise.reject(new Error("Choose an image file."));
    if (file.size > 8 * 1024 * 1024) return Promise.reject(new Error("Choose an image smaller than 8 MB."));

    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(image.naturalWidth * scale);
            canvas.height = Math.round(image.naturalHeight * scale);
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(objectUrl);
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error("This image could not be processed."));
                    return;
                }
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error("This image could not be read."));
                reader.readAsDataURL(blob);
            }, "image/jpeg", 0.76);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("This image could not be opened."));
        };
        image.src = objectUrl;
    });
};

const wirePhotoPreview = (inputId, previewId) => {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;

    input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) {
            preview.hidden = true;
            preview.removeAttribute("src");
            return;
        }
        if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
            input.value = "";
            preview.hidden = true;
            alert(file.size > 8 * 1024 * 1024 ? "Choose an image smaller than 8 MB." : "Choose an image file.");
            return;
        }
        preview.src = URL.createObjectURL(file);
        preview.hidden = false;
    });
};

wirePhotoPreview("incidentPhoto", "incidentPhotoPreview");
wirePhotoPreview("lostItemPhoto", "lostItemPhotoPreview");

const seedReports = () => {
    if (!localStorage.getItem("campusSafeReports")) {
        const initial = [
            { type: "Suspicious activity", location: "North Gate", status: "Pending" },
            { type: "Medical alert", location: "Student Center", status: "Resolved" }
        ];
        saveReports(initial);
    }
};

const seedLostItems = () => {
    if (!localStorage.getItem("campusSafeLostItems")) {
        const initial = [
            { item: "Black student ID card", location: "Library", note: "Found near the study lounge." },
            { item: "Blue water bottle", location: "Science block", note: "Left behind in lab 204." }
        ];
        saveLostItems(initial);
    }
};

let caseStatusChart;

const statusCounts = (reports) => ({
    Pending: reports.filter((report) => (report.status || "Pending") === "Pending").length,
    "In Progress": reports.filter((report) => report.status === "In Progress").length,
    Resolved: reports.filter((report) => report.status === "Resolved").length
});

const downloadReportPdf = (reports) => {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
        alert("PDF export could not load. Check your internet connection and try again.");
        return;
    }

    const pdf = new jsPDF();
    let y = 22;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("CampusSafe Incident Report", 18, y);
    y += 10;

    reports.forEach((report, index) => {
        const detailLines = [
            `Case ${index + 1} | ${report.type || "Safety concern"}`,
            `Status: ${report.status || "Pending"}    Urgency: ${report.urgency || "Not specified"}`,
            `Location: ${report.location || "Unknown"}`,
            `Reported: ${report.createdAt ? new Date(report.createdAt).toLocaleString() : "Date not recorded"}`,
            `Description: ${report.description || "No details provided."}`
        ];
        const wrapped = detailLines.flatMap((line) => pdf.splitTextToSize(line, 174));
        const sectionHeight = wrapped.length * 6 + (report.photo ? 48 : 8);
        if (y + sectionHeight > 275) {
            pdf.addPage();
            y = 20;
        }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text(wrapped[0], 18, y);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text(wrapped.slice(1), 18, y + 6);
        y += wrapped.length * 6 + 5;
        if (report.photo) {
            try {
                pdf.addImage(report.photo, "JPEG", 18, y, 50, 38, undefined, "FAST");
                y += 44;
            } catch (error) {
                console.warn("Could not add report image to PDF:", error);
            }
        }
        y += 6;
    });

    pdf.save("campussafe-incident-reports.pdf");
};

const renderReportDashboard = (reports) => {
    const counts = statusCounts(reports);
    const total = document.getElementById("totalCases");
    if (!total) return;
    total.textContent = reports.length;
    document.getElementById("pendingCases").textContent = counts.Pending;
    document.getElementById("inProgressCases").textContent = counts["In Progress"];
    document.getElementById("resolvedCases").textContent = counts.Resolved;

    if (!window.Chart) return;
    const canvas = document.getElementById("caseStatusChart");
    if (!canvas) return;
    const chartData = {
        labels: ["Pending", "In progress", "Resolved"],
        datasets: [{
            label: "Reported cases",
            data: [counts.Pending, counts["In Progress"], counts.Resolved],
            backgroundColor: ["#f59e0b", "#1d4ed8", "#10b981"],
            borderRadius: 5,
            maxBarThickness: 72
        }]
    };
    if (caseStatusChart) {
        caseStatusChart.data = chartData;
        caseStatusChart.update();
    } else {
        caseStatusChart = new window.Chart(canvas, {
            type: "bar",
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#e2e8f0" } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
};

const renderReports = () => {
    const tableBody = document.getElementById("reportsTableBody");
    if (!tableBody) return;

    seedReports();
    const reports = loadReports();
    renderReportDashboard(reports);
    const downloadAll = document.getElementById("downloadAllReports");
    if (downloadAll && !downloadAll.dataset.bound) {
        downloadAll.dataset.bound = "true";
        downloadAll.addEventListener("click", () => downloadReportPdf(reports));
    }
    tableBody.replaceChildren();
    reports.forEach((report, index) => {
        const badgeClass = report.status === "Resolved" ? "bg-success" : report.status === "In Progress" ? "bg-primary" : "bg-warning text-dark";
        const row = document.createElement("tr");
        [report.type || "Safety concern", report.location || "Unknown"].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.append(cell);
        });
        const statusCell = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = `badge ${badgeClass}`;
        badge.textContent = report.status || "Pending";
        statusCell.append(badge);
        row.append(statusCell);

        const photoCell = document.createElement("td");
        if (report.photo) {
            const photo = document.createElement("a");
            photo.href = report.photo;
            photo.target = "_blank";
            photo.rel = "noopener";
            photo.textContent = "View photo";
            photoCell.append(photo);
        } else {
            photoCell.textContent = "None";
        }
        row.append(photoCell);

        const downloadCell = document.createElement("td");
        const downloadButton = document.createElement("button");
        downloadButton.type = "button";
        downloadButton.className = "btn btn-sm btn-outline-primary";
        downloadButton.setAttribute("aria-label", `Download report ${index + 1} as PDF`);
        downloadButton.innerHTML = '<i class="fa-solid fa-file-pdf"></i>';
        downloadButton.addEventListener("click", () => downloadReportPdf([report]));
        downloadCell.append(downloadButton);
        row.append(downloadCell);
        tableBody.append(row);
    });
};

const renderLostItems = () => {
    const list = document.getElementById("lostItemList");
    if (!list) return;

    seedLostItems();
    const items = loadLostItems();
    list.replaceChildren();
    items.forEach((item) => {
        const card = document.createElement("article");
        card.className = "notice-item";
        const meta = document.createElement("div");
        meta.className = "notice-meta";
        const title = document.createElement("h3");
        title.textContent = item.item || "Unnamed item";
        const kind = document.createElement("span");
        kind.textContent = `${item.status || "Found"} · ${item.location || "Unknown location"}`;
        meta.append(title, kind);
        card.append(meta);
        const note = document.createElement("p");
        note.textContent = item.note || "No additional details provided.";
        card.append(note);
        if (item.photo) {
            const photo = document.createElement("img");
            photo.className = "item-photo";
            photo.src = item.photo;
            photo.alt = `${item.item || "Item"} photo`;
            photo.loading = "lazy";
            card.append(photo);
        }
        list.append(card);
    });
};

const renderProfileForm = () => {
    const profileForm = document.getElementById("profileForm");
    if (!profileForm) return;

    const user = loadUser();
    if (!user) return;

    const nameField = document.getElementById("profileName");
    const studentIdField = document.getElementById("profileStudentId");
    const emailField = document.getElementById("profileEmail");
    const phoneField = document.getElementById("profilePhone");

    if (nameField) nameField.value = user.name || "";
    if (studentIdField) studentIdField.value = user.studentId || "";
    if (emailField) emailField.value = user.email || "";
    if (phoneField) phoneField.value = user.phone || "";
};

const renderSettingsForm = () => {
    const settingsForm = document.getElementById("settingsForm");
    if (!settingsForm) return;

    const saved = JSON.parse(
        localStorage.getItem("campusSafeSettings") || '{"safetyAlerts":true,"announcements":true,"escortReminders":false}'
    );

    const checkboxes = [
        ["safetyAlerts", saved.safetyAlerts !== false],
        ["announcements", saved.announcements !== false],
        ["escortReminders", !!saved.escortReminders]
    ];

    checkboxes.forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) input.checked = value;
    });
};

// ========================================
// REGISTRATION
// ========================================

const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        const role = document.getElementById("role").value;

        if (!name || !email || !password || !confirmPassword) {
            showMessage("Please fill in all the required fields.");
            return;
        }

        if (password.length < 6) {
            showMessage("Password must be at least 6 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            showMessage("Passwords do not match.");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name,
                email,
                role,
                createdAt: new Date()
            });

            saveSession({
                uid: user.uid,
                name,
                email,
                role
            });

            showMessage("Account created successfully! Redirecting to login...", "success");

            window.setTimeout(() => {
                window.location.href = "login.html";
            }, 1200);
        } catch (error) {
            console.error("Registration error:", error);

            try {
                const fallbackUser = registerDemoUser(name, email, password, role);
                saveSession({
                    uid: fallbackUser.uid,
                    name: fallbackUser.name,
                    email: fallbackUser.email,
                    role: fallbackUser.role
                });

                showMessage("Account created in demo mode. Redirecting to login...", "success");

                window.setTimeout(() => {
                    window.location.href = "login.html";
                }, 1200);
            } catch (demoError) {
                showMessage(`Registration failed: ${demoError.message || error.message}`);
            }
        }
    });
}

// ========================================
// LOGIN
// ========================================

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearSession();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const selectedRole = document.getElementById("loginRole").value;

        if (!email || !password) {
            showMessage("Please enter your email and password.");
            return;
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const userRef = doc(db, "users", user.uid);
            const userSnapshot = await getDoc(userRef);

            if (!userSnapshot.exists()) {
                showMessage("Your CampusSafe profile was not found. Please create an account first.");
                return;
            }

            const userData = userSnapshot.data();
            const accountRole = userData.role || "student";
            if (accountRole !== selectedRole) {
                await signOut(auth);
                const roleLabel = accountRole === "security" ? "Security Team" : accountRole === "administration" ? "Administration" : "Student";
                showMessage(`This account is registered for ${roleLabel}. Choose the matching account type.`);
                return;
            }

            saveSession({
                uid: user.uid,
                name: userData.name || "Student",
                email: user.email,
                role: accountRole
            });

            if (accountRole === "security" || accountRole === "administration") {
                window.location.href = "admin/dashboard.html";
            } else {
                window.location.href = "dashboard.html";
            }
            return;
        } catch (error) {
            console.error("Login error:", error);

            const demoUser = attemptDemoLogin(email, password);
            if (demoUser) {
                if (demoUser.role !== selectedRole) {
                    const roleLabel = demoUser.role === "security" ? "Security Team" : "Student";
                    showMessage(`This account is registered for ${roleLabel}. Choose the matching account type.`);
                    return;
                }

                saveSession(demoUser);
                if (demoUser.role === "security" || demoUser.role === "administration") {
                    window.location.href = "admin/dashboard.html";
                } else {
                    window.location.href = "dashboard.html";
                }
                return;
            }

            showMessage(`Login failed: ${error.message}`);
        }
    });
}

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        try {
            await signOut(auth);
            clearSession();

            const loginPath = window.location.pathname.includes("/admin/")
                ? "../login.html"
                : "login.html";

            window.location.href = loginPath;
        } catch (error) {
            console.error("Logout error:", error);
            alert("Unable to log out right now.");
        }
    });
}

const reportForm = document.getElementById("reportForm");
if (reportForm) {
    reportForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const type = document.getElementById("incidentType")?.value || "Safety concern";
        const urgency = document.getElementById("incidentUrgency")?.value || "Medium";
        const location = document.getElementById("incidentLocation")?.value.trim() || "Unknown";
        const description = document.getElementById("incidentDescription")?.value.trim() || "No details provided";

        try {
            const photo = await readPhoto(document.getElementById("incidentPhoto"));
            const reports = loadReports();
            reports.unshift({
                id: `case-${Date.now()}`,
                type,
                urgency,
                location,
                description,
                photo,
                reportedBy: loadUser()?.name || loadUser()?.email || "Campus user",
                createdAt: new Date().toISOString(),
                status: "Pending"
            });
            saveReports(reports);

            alert("Incident reported successfully.");
            window.location.href = "reports.html";
        } catch (error) {
            alert(error.message || "The report could not be saved. Try a smaller image.");
        }
    });
}

const profileForm = document.getElementById("profileForm");
if (profileForm) {
    renderProfileForm();
    profileForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const profile = {
            name: document.getElementById("profileName")?.value.trim() || "Student",
            studentId: document.getElementById("profileStudentId")?.value.trim() || "",
            email: document.getElementById("profileEmail")?.value.trim() || "",
            phone: document.getElementById("profilePhone")?.value.trim() || ""
        };

        saveProfileData(profile);
        alert("Profile updated successfully.");
    });
}

const settingsForm = document.getElementById("settingsForm");
if (settingsForm) {
    renderSettingsForm();
    settingsForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const settings = {
            safetyAlerts: document.getElementById("safetyAlerts")?.checked ?? true,
            announcements: document.getElementById("announcements")?.checked ?? true,
            escortReminders: document.getElementById("escortReminders")?.checked ?? false
        };
        localStorage.setItem("campusSafeSettings", JSON.stringify(settings));
        alert("Preferences saved successfully.");
    });
}

const lostFoundForm = document.getElementById("lostFoundForm");
if (lostFoundForm) {
    lostFoundForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const item = document.getElementById("lostItemName")?.value.trim() || "Unnamed item";
        const location = document.getElementById("lostItemLocation")?.value.trim() || "Unknown location";
        const note = document.getElementById("lostItemNote")?.value.trim() || "No additional details provided.";
        const status = document.getElementById("lostItemStatus")?.value || "Lost";

        try {
            const photo = await readPhoto(document.getElementById("lostItemPhoto"));
            const items = loadLostItems();
            items.unshift({ item, location, note, status, photo, createdAt: new Date().toISOString() });
            saveLostItems(items);
            alert(`${status} item submitted successfully.`);
            window.location.reload();
        } catch (error) {
            alert(error.message || "The item could not be saved. Try a smaller image.");
        }
    });
}

const lostItemList = document.getElementById("lostItemList");
if (lostItemList) renderLostItems();

const reportsTableBody = document.getElementById("reportsTableBody");
if (reportsTableBody) renderReports();

const sosTrigger = document.querySelectorAll(".sos-button, .sos-mini, .secondary-action");
sosTrigger.forEach((button) => {
    button.addEventListener("click", () => {
        alert("This demo cannot contact campus security. For immediate help, call the emergency number or campus security listed on this page.");
    });
});

const searchInput = document.getElementById("globalSearch");
if (searchInput) {
    searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim().toLowerCase();
        const navItems = document.querySelectorAll(".nav-item, .tool-card");
        navItems.forEach((item) => {
            const text = item.textContent.toLowerCase();
            item.hidden = Boolean(query && !text.includes(query));
        });
    });
}

document.querySelectorAll("[data-open-support]").forEach((button) => {
    button.addEventListener("click", () => {
        const chatWidget = document.getElementById("chatWidget");
        const chatToggle = document.getElementById("chatToggle");
        if (!chatWidget || !chatToggle) return;
        chatWidget.classList.add("open");
        chatToggle.setAttribute("aria-expanded", "true");
        chatToggle.setAttribute("aria-label", "Close chat");
    });
});