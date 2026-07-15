export async function login(
  username: string,
  password: string,
): Promise<boolean> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  return res.ok;
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
}
