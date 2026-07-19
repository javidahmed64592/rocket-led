import "./App.css";

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Layout from "./lib/components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Mappings from "./pages/Mappings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/mappings" element={<Mappings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
