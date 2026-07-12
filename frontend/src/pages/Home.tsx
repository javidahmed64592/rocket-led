import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchProtected, logout } from "@/lib/api";

export default function Home() {
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProtected()
      .then((data) => setMessage(data.message))
      .catch(() => navigate("/login"));
  }, [navigate]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  if (message === null) return <p>Loading...</p>;

  return (
    <div>
      <p>{message}</p>
      <button onClick={handleLogout}>Log out</button>
    </div>
  );
}
