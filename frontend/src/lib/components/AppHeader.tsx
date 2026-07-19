import { NavLink, useNavigate } from "react-router-dom";

import { logout } from "@/lib/api";

export default function AppHeader() {
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-brand">
          <span className="app-header-logo" aria-hidden="true">
            🚀
          </span>
          <span className="app-header-name">rocket-led</span>
        </div>
        <nav className="app-header-nav">
          <NavLink
            to="/home"
            className={({ isActive }) =>
              isActive ? "nav-link nav-link--active" : "nav-link"
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/mappings"
            className={({ isActive }) =>
              isActive ? "nav-link nav-link--active" : "nav-link"
            }
          >
            Mappings
          </NavLink>
          <button className="dashboard-btn" onClick={handleLogout}>
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
