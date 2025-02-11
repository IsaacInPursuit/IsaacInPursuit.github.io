
// GSAP ScrollMagic animations
window.addEventListener("load", () => {
    gsap.from("header h1", { opacity: 0, y: -200, duration: 1, ease: "bounce" });

    // Hero Section Animation
    gsap.from(".hero-text h3", { opacity: 0, x: -100, duration: 1 });
    gsap.from(".hero-text p", { opacity: 0, x: 100, duration: 1, delay: 0.5 });
    gsap.from(".hero-image", { opacity: 0, y: 50, duration: 1, delay: 0.7 });

    // ScrollMagic for Jobs Section
    let controller = new ScrollMagic.Controller();
    let scene = new ScrollMagic.Scene({
        triggerElement: "#target-jobs",
        triggerHook: 0.8,
    })
    .setClassToggle("#target-jobs", "visible") // Class to be added when in view
    .addTo(controller);

    // Contact Form Button Hover Effect
    const formButton = document.querySelector("form button");
    formButton.addEventListener("mouseenter", () => {
        formButton.style.transform = "scale(1.1)";
    });
    formButton.addEventListener("mouseleave", () => {
        formButton.style.transform = "scale(1)";
    });
});
