document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");

    if (!menuToggle || !mainNav) return;

    menuToggle.addEventListener("click", () => {
        mainNav.classList.toggle("active");

        const isOpen = mainNav.classList.contains("active");

        menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
        menuToggle.setAttribute(
            "aria-label",
            isOpen ? "Close menu" : "Open menu"
        );
    });

    mainNav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            mainNav.classList.remove("active");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open menu");
        });
    });
});
