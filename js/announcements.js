const DEFAULT_ANNOUNCEMENTS = [
    {
        title: "Campus lighting upgrade",
        message: "Additional lighting will be installed on the north walkway from 6pm to 9pm.",
        publishedAt: ""
    },
    {
        title: "Emergency drill",
        message: "A campus-wide emergency evacuation drill will take place at 11:00 AM.",
        publishedAt: ""
    },
    {
        title: "Escort service extension",
        message: "Night escort coverage has been extended to 12:30 AM for the student residence loop.",
        publishedAt: ""
    }
];

const readAnnouncements = () => {
    const stored = JSON.parse(localStorage.getItem("campusSafeAnnouncements") || "null");
    if (!Array.isArray(stored)) return DEFAULT_ANNOUNCEMENTS;
    return stored.map((item) => {
        if (typeof item !== "string") return item;
        const separator = item.indexOf(":");
        return {
            title: separator < 0 ? "Campus update" : item.slice(0, separator),
            message: separator < 0 ? item : item.slice(separator + 1).trim(),
            publishedAt: ""
        };
    });
};

const appendAnnouncement = (container, announcement, isPublic = false) => {
    const item = document.createElement(isPublic ? "article" : "li");
    item.className = isPublic ? "notice-item" : "list-group-item";

    if (isPublic) {
        const meta = document.createElement("div");
        meta.className = "notice-meta";
        const title = document.createElement("h3");
        title.textContent = announcement.title || "Campus update";
        const date = document.createElement("span");
        date.textContent = announcement.publishedAt
            ? new Date(announcement.publishedAt).toLocaleDateString()
            : "Campus update";
        meta.append(title, date);
        const message = document.createElement("p");
        message.textContent = announcement.message || "";
        item.append(meta, message);
    } else {
        item.textContent = `${announcement.title || "Campus update"}: ${announcement.message || ""}`;
    }

    container.append(item);
};

const renderAnnouncements = () => {
    const announcements = readAnnouncements();
    const adminList = document.getElementById("announcementList");
    const publicList = document.getElementById("publicAnnouncementList");

    if (adminList) {
        adminList.replaceChildren();
        announcements.forEach((announcement) => appendAnnouncement(adminList, announcement));
    }
    if (publicList) {
        publicList.replaceChildren();
        announcements.forEach((announcement) => appendAnnouncement(publicList, announcement, true));
    }
};

const announcementForm = document.getElementById("announcementForm");
if (announcementForm) {
    announcementForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const title = document.getElementById("announcementTitle").value.trim();
        const message = document.getElementById("announcementMessage").value.trim();
        if (!title || !message) return;

        const announcements = readAnnouncements();
        announcements.unshift({ title, message, publishedAt: new Date().toISOString() });
        localStorage.setItem("campusSafeAnnouncements", JSON.stringify(announcements));
        announcementForm.reset();
        renderAnnouncements();
    });
}

renderAnnouncements();