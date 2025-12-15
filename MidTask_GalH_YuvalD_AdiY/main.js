/* =========================================
   SCORM handling
   ========================================= */
let scormConnected = false;

// ניסיון חיבור ל-LMS (SCORM 1.2) ברגע שהעמוד נטען
function initScorm() {
    if (!window.pipwerks || !pipwerks.SCORM) {
        console.log("SCORM wrapper not found – running in demo mode.");
        scormConnected = false;
        return;
    }

    pipwerks.SCORM.version = "1.2";
    scormConnected = pipwerks.SCORM.init();

    if (scormConnected) {
        console.log("SCORM connection established.");
        pipwerks.SCORM.set("cmi.core.lesson_status", "incomplete");
    } else {
        console.log("SCORM connection failed – demo mode.");
    }
}

/**
 * בונה מחרוזת קריאה למרצה לדוחות ה-SCORM (cmi.comments)
 */
function buildHumanReadableSurveyString(data) {
    const parts = [];

    parts.push("קורס: " + (data.courseName || ""));

    parts.push("תרומה: " + (data.contribution || "לא נבחר"));
    parts.push("המלצה: " + (data.recommend || "לא נבחר"));
    parts.push("רצון לעוד קורס: " + (data.nextCourse || "לא נבחר"));

    if (data.feedback && data.feedback.trim() !== "") {
        const cleanFeedback = data.feedback.replace(/"/g, "'");
        parts.push('משוב: "' + cleanFeedback + '"');
    }

    parts.push("זמן: " + (data.timestamp || ""));

    return parts.join(" | ");
}

// שמירת הנתונים (אם מחוברים)
function saveSurveyToLMS(surveyData) {
    if (!scormConnected || !window.pipwerks || !pipwerks.SCORM) {
        console.log("Survey data (demo mode):", surveyData);
        return false;
    }

    try {
        const suspendJSON = JSON.stringify(surveyData);
        pipwerks.SCORM.set("cmi.suspend_data", suspendJSON);

        const humanReadable = buildHumanReadableSurveyString(surveyData);
        pipwerks.SCORM.set("cmi.comments", humanReadable);

        pipwerks.SCORM.set("cmi.core.lesson_status", "completed");
        pipwerks.SCORM.save();

        console.log("Survey data saved:", suspendJSON, humanReadable);
        return true;
    } catch (err) {
        console.error("Error saving survey data:", err);
        return false;
    }
}

function quitScorm() {
    if (scormConnected && window.pipwerks && pipwerks.SCORM) {
        pipwerks.SCORM.quit();
        scormConnected = false;
        console.log("SCORM connection closed.");
    }
}

/* =========================================
   Units search (live filter) + "לא נמצא"
   ========================================= */

function setupSearch() {
    const desktopInput = document.getElementById("search-input");
    const desktopButton = document.getElementById("search-button");
    const mobileInput = document.getElementById("search-input-mobile");
    const mobileButton = document.getElementById("search-button-mobile");

    const noResultsBox = document.getElementById("no-results");

    function setNoResultsVisible(isVisible) {
        if (!noResultsBox) return;
        noResultsBox.classList.toggle("d-none", !isVisible);
    }

    function runSearch(query) {
        const value = (query || "").toString().trim().toLowerCase();
        const cards = document.querySelectorAll(".unit-card");

        let visibleCount = 0;

        cards.forEach((card) => {
            const titleAttr = (card.getAttribute("data-unit-title") || "").toLowerCase();
            const cardText = card.innerHTML.toLowerCase();
            const matches = titleAttr.includes(value) || cardText.includes(value);
            card.style.display = matches ? "" : "none";
            if (matches) visibleCount += 1;
        });

        // אם יש טקסט חיפוש ואין תוצאות – מציגים הודעה
        if (value !== "" && visibleCount === 0) {
            setNoResultsVisible(true);
        } else {
            setNoResultsVisible(false);
        }
    }

    if (desktopInput) {
        desktopInput.addEventListener("input", function () {
            runSearch(desktopInput.value);
        });

        desktopInput.addEventListener("keydown", function (ev) {
            if (ev.key === "Enter") {
                ev.preventDefault();
                runSearch(desktopInput.value);
            }
        });
    }
    if (desktopButton) {
        desktopButton.addEventListener("click", function (ev) {
            ev.preventDefault();
            runSearch(desktopInput ? desktopInput.value : "");
        });
    }

    if (mobileInput) {
        mobileInput.addEventListener("input", function () {
            runSearch(mobileInput.value);
        });

        mobileInput.addEventListener("keydown", function (ev) {
            if (ev.key === "Enter") {
                ev.preventDefault();
                runSearch(mobileInput.value);
            }
        });
    }
    if (mobileButton) {
        mobileButton.addEventListener("click", function (ev) {
            ev.preventDefault();
            runSearch(mobileInput ? mobileInput.value : "");
        });
    }
}

/* =========================================
   Survey form – validate + send
   ========================================= */

function setupSurveyForm() {
    const form = document.getElementById("survey-form");
    if (!form) return;

    const messageBox = document.getElementById("survey-message");

    function showMessage(type, text) {
        if (!messageBox) return;

        messageBox.className = "";
        messageBox.classList.add("mt-3", "p-3", "rounded-3");

        if (type === "error") {
            messageBox.classList.add("alert", "alert-danger");
        } else if (type === "success") {
            messageBox.classList.add("alert", "alert-success");
        } else {
            messageBox.classList.add("alert", "alert-warning");
        }

        messageBox.innerHTML = text;
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();

        const courseName = document.getElementById("course-name")?.value || "";
        const feedbackText = document.getElementById("feedback-text")?.value || "";

        const contribution = form.querySelector("input[name='q-contribution']:checked");
        const recommend = form.querySelector("input[name='q-recommend']:checked");
        const nextCourse = form.querySelector("input[name='q-next-course']:checked");

        // חובה: כל השאלות (כולל טקסט פתוח)
        if (!contribution || !recommend || !nextCourse || feedbackText.trim() === "") {
            showMessage("error", "יש לענות על כל שאלות שביעות הרצון לפני שליחת המשוב.");
            return;
        }

        const surveyData = {
            courseName: courseName,
            feedback: feedbackText,
            contribution: contribution.value,
            recommend: recommend.value,
            nextCourse: nextCourse.value,
            timestamp: new Date().toISOString()
        };

        const saved = saveSurveyToLMS(surveyData);

        if (saved) {
            showMessage("success", "המשוב נשלח ונשמר בהצלחה. תודה רבה על השתתפותך!");
        } else {
            showMessage("success", "המשוב נשלח (דמו) – הנתונים נשמרו לצורך בדיקות.");
        }

        const submitBtn = document.getElementById("btn-submit");
        if (submitBtn) {
            submitBtn.disabled = true;
        }
    });
}

/* =========================================
   Init on load + quit on unload
   ========================================= */

document.addEventListener("DOMContentLoaded", function () {
    initScorm();
    setupSearch();
    setupSurveyForm();
});

window.addEventListener("unload", quitScorm);