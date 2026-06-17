document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const status = document.getElementById("loginStatus");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.className = "status-box";
    status.textContent = "جاري تسجيل الدخول...";
    status.classList.remove("hidden");
    try {
      const fd = new FormData(form);
      const result = await authApiPost({ action: "loginUser", identifier: fd.get("identifier"), password: fd.get("password") });
      if (!result.ok) throw new Error(result.error || "فشل تسجيل الدخول");
      saveAuth({ token: result.token, user: result.user });
      status.classList.add("success");
      status.textContent = "تم تسجيل الدخول بنجاح.";
      setTimeout(() => location.href = "index.html", 400);
    } catch (error) {
      status.classList.add("error");
      status.textContent = error.message;
    }
  });
});