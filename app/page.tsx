export default function Page() {
  const year = new Date().getFullYear();
  return (
    <main className="mx-auto max-w-3xl px-4">
      {/* HEADER AREA WITH YOUR NAME AND BUTTONS */}
      <header className="pt-8">
        <h1 className="text-3xl font-bold">Isaac Johnston</h1>
        <p className="text-neutral-600 dark:text-neutral-300">
          Entrepreneur • Real Estate and Finance • Startups
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Primary */}
          <a href="#contact" className="inline-flex items-center rounded-md bg-[#0A2239] px-4 py-2 text-white hover:opacity-90">
            Connect
          </a>
          {/* Secondary */}
          <a href="/resume.pdf" className="inline-flex items-center rounded-md border px-4 py-2 text-[#0A2239] border-[#0A2239]/30 hover:bg-black/5 dark:hover:bg-white/5">
            Resume
          </a>
          <a href="/calendar" className="inline-flex items-center rounded-md border px-4 py-2 text-[#0A2239] border-[#0A2239]/30 hover:bg-black/5 dark:hover:bg-white/5">
            Book a Call
          </a>
        </div>
      </header>

      {/* VISUAL HOOK OPTION A UNDER HEADER */}
      <section className="relative h-40 md:h-56 overflow-hidden mt-6">
        <svg className="absolute inset-0 w-full h-full opacity-20 dark:opacity-25" viewBox="0 0 800 200" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#0A2239" />
              <stop offset="100%" stopColor="#D72638" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="800" height="200" fill="url(#g1)" />
          <g fill="none" stroke="white" strokeOpacity="0.15">
            <path d="M0 150 C150 100, 300 200, 450 150 S750 100, 800 160" />
            <path d="M0 120 C150 70, 300 170, 450 120 S750 70, 800 130" />
          </g>
        </svg>
      </section>

      {/* ABOUT */}
      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">About</h2>
        <p>
          I build in real estate, finance, and startups. My faith in God guides me. I connect students with businesses, and I am creating MVPs in compliance, real estate, and local growth. I learn every day and welcome guidance. I work to create value with integrity.
        </p>
      </section>

      {/* EDUCATION */}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Education</h2>
        <div className="mt-4 space-y-4">
          <p>
            With a background in Business, a concentration in Criminal Justice | Criminology, and a minor in Psychology and American History
            (focused on economics, politics, and computing), I view business through the lens of systems, behavior, and law.
          </p>
          <p>
            Rather than attend business school, I gained practical experience through ventures and coursework, deepening my understanding of
            business in real world contexts.
          </p>
          <p>
            My goal is to thrive in dynamic organizations that value innovation, integrity, and sustainability while developing my skills in
            wealth management and financial strategy. I aim to grow my investments and expand my portfolio knowledge to benefit both my
            personal growth and my clients or employers. Ultimately, I am seeking a protege role or an executive assistant in training to gain
            hands on experience, with the long term goal of taking on greater leadership responsibilities.
          </p>
          <figure className="border-l-4 border-neutral-300 dark:border-neutral-700 pl-4 italic text-neutral-700 dark:text-neutral-300">
            “I like to be part of a safety net always”
          </figure>
        </div>
      </section>

      {/* PROJECTS */}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Projects</h2>
        <p className="mt-2">Add your project cards or links here.</p>
      </section>

      {/* SKILLS UNDER PROJECTS */}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Skills</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <h3 className="font-medium">Finance & Real Estate</h3>
            <ul className="list-disc pl-5">
              <li>Deal structuring</li>
              <li>Underwriting</li>
              <li>Assignment closings</li>
              <li>Wholesaling</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium">Tech</h3>
            <ul className="list-disc pl-5">
              <li>Next.js, Expo, GitHub</li>
              <li>Compliance workflows</li>
              <li>Node hosting</li>
              <li>Local LLMs and vibe coding</li>
              <li>Basic web dev</li>
              <li>Flashed Linux on my MacBook</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium">Leadership</h3>
            <ul className="list-disc pl-5">
              <li>Founder of UNCC Student Network</li>
              <li>Connecting 2.5k+ students with jobs and events</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FUTURE FACING LINE ABOVE CONTACT */}
      <section className="mt-10">
        <p className="text-lg">
          I am looking to contribute to early stage teams where I can grow, learn from experienced leaders, and create scalable value.
        </p>
      </section>

      {/* CONTACT */}
      <section id="contact" className="mt-10">
        <h2 className="text-2xl font-semibold">Contact</h2>
        <form id="contact-form" className="mt-4 space-y-3">
          <input className="w-full rounded-md border p-2" name="name" placeholder="Name" required />
          <input className="w-full rounded-md border p-2" name="email" placeholder="Email" type="email" required />
          <textarea className="w-full rounded-md border p-2" name="message" rows={5} placeholder="Message" required />
          <button className="rounded-md bg-[#0A2239] px-4 py-2 text-white" type="submit">Send</button>
          <p id="contact-ok" className="hidden text-green-700 mt-2">Thanks, I will get back to you soon.</p>
        </form>

        {/* Inline script to post to Apps Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  var f = document.getElementById("contact-form");
  if(!f) return;
  f.addEventListener("submit", async function(e){
    e.preventDefault();
    var payload = { name: f.name.value, email: f.email.value, message: f.message.value };
    try {
      await fetch("PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      f.reset();
      document.getElementById("contact-ok").classList.remove("hidden");
    } catch(e){
      console.error(e);
      alert("Error sending message. Try again later.");
    }
  });
})();
          `,
          }}
        />
      </section>

      <footer className="my-16 text-center text-sm text-neutral-500">
        © {year} Isaac Johnston
      </footer>
    </main>
  );
}
