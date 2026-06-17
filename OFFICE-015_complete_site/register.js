document.addEventListener("DOMContentLoaded", async () => {
  const settings = await loadSiteSettings();
  if (settings && settings.allow_customer_register === "no") {
    const form = document.getElementById("registerForm");
    const status = document.getElementById("registerStatus");
    form.querySelectorAll("input, button, select, textarea").forEach((el) => el.disabled = true);
    status.className = "status-box error";
    status.textContent = "تسجيل العملاء مغلق حاليًا.";
    status.classList.remove("hidden");
    return;
  }

  const form = document.getElementById("registerForm");
  const status = document.getElementById("registerStatus");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.className = "status-box";
    status.textContent = "جاري إنشاء الحساب...";
    status.classList.remove("hidden");
    try {
      const fd = new FormData(form);
      const termsAccepted = form.elements.terms_accepted && form.elements.terms_accepted.checked;

      if (!termsAccepted) {
        throw new Error("يجب الموافقة على الشروط والأحكام قبل إنشاء الحساب.");
      }

      const result = await authApiPost({
        action: "registerUser",
        name: fd.get("name"),
        phone: fd.get("phone"),
        email: fd.get("email"),
        password: fd.get("password"),
        terms_accepted: "yes"
      });
      if (!result.ok) throw new Error(result.error || "فشل إنشاء الحساب");
      saveAuth({ token: result.token, user: result.user });
      status.classList.add("success");
      status.textContent = "تم إنشاء الحساب بنجاح.";
      setTimeout(() => location.href = "my-properties.html", 500);
    } catch (error) {
      status.classList.add("error");
      status.textContent = error.message;
    }
  });
});