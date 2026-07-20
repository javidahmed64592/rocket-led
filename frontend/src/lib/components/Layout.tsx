import { Outlet } from "react-router-dom";

import AppHeader from "./AppHeader";

export default function Layout() {
  return (
    <div className="dashboard-page">
      <AppHeader />
      <main className="app-main">
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
