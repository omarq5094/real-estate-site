function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";

  if (button) {
    button.textContent = isPassword ? "🙈" : "👁️";
    button.setAttribute("aria-label", isPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
  }
}
