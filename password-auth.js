// Passwords go only to Supabase Auth. Never persist them in app state or logs.
export const validEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
// Rules for a new or changed password. Existing passwords still log in unchanged.
export const PASSWORD_RULES = Object.freeze([
  ["length", "At least 8 characters", p => p.length >= 8],
  ["capital", "A capital letter", p => /\p{Lu}/u.test(p)],
  ["number", "A number", p => /\p{Nd}/u.test(p)],
]);
export const passwordRuleState = password => PASSWORD_RULES.map(([id, label, test]) => ({ id, label, ok: typeof password === "string" && test(password) }));
export function validateNewPassword(password, confirm) {
  if (typeof password !== "string" || password.length < 8) throw Error("Use a password with at least 8 characters.");
  if (!/\p{Lu}/u.test(password)) throw Error("Add a capital letter to your password.");
  if (!/\p{Nd}/u.test(password)) throw Error("Add a number to your password.");
  if (password !== confirm) throw Error("The passwords don’t match.");
}
export function authError(error) {
  const code = error?.code || "", message = String(error?.message || error || "");
  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) return "Email or password is incorrect. Try again or use Forgot password.";
  if (code === "email_not_confirmed") return "Confirm your email before logging in. Check your inbox and spam folder.";
  if (code === "email_address_not_authorized") return "We couldn’t send email to this address. Try again later or contact support.";
  if (/rate_limit|over_email_send_rate_limit/.test(code)) return "Too many requests. Wait before trying again.";
  if (/otp_expired|flow_state_expired|bad_code_verifier|flow_state_not_found/.test(code)) return "This sign-in or reset link expired, or was opened in a different browser. Request a new link and open it in the same browser.";
  if (/fetch|network|load failed/i.test(message)) return "Couldn’t reach the account service. Check your connection and try again.";
  if (/supabase|smtp|database|configuration|unexpected_failure/i.test(message+" "+code)) return "The account service couldn’t finish this request. Please try again or contact support.";
  return message || "Sign-in failed. Please try again.";
}
export function createPasswordAuth(auth, redirectTo) {
  const emailCheck = email => { if (!validEmail(email)) throw Error("Enter a valid email address."); };
  const result = async promise => { const response = await promise; if (response.error) throw Error(authError(response.error)); return response.data; };
  return {
    async login(email,password) { emailCheck(email); if (!password) throw Error("Enter your password."); return result(auth.signInWithPassword({email,password})); },
    async signup(email,password,confirm) { emailCheck(email); validateNewPassword(password,confirm); return result(auth.signUp({email,password,options:{emailRedirectTo:redirectTo()}})); },
    async resend(email) { emailCheck(email); return result(auth.resend({type:"signup",email,options:{emailRedirectTo:redirectTo()}})); },
    async reset(email) { emailCheck(email); return result(auth.resetPasswordForEmail(email,{redirectTo:redirectTo()})); },
    async update(password,confirm) { validateNewPassword(password,confirm); return result(auth.updateUser({password})); },
  };
}
