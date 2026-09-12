import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Join from "./pages/Join";
import Play from "./pages/Play";
import Questions from "./pages/Questions";
import Administration from "./pages/Administration";
import "./style.css";
function App() {
  return (
    <>
      <header>
        <Link className="brand" to="/">
          ◐ KOJE LO KUKO
        </Link>
        <span>El conocimiento se comparte.</span>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/teacher/login" element={<Auth key="login" />} />
        <Route
          path="/teacher/register"
          element={<Auth key="register" register />}
        />
        <Route path="/teacher" element={<Dashboard />} />
        <Route path="/admin" element={<Administration />} />
        <Route path="/teacher/questions" element={<Questions />} />
        <Route path="/teacher/games/:id" element={<Play teacher />} />
        <Route path="/join" element={<Join />} />
        <Route path="/play/:code" element={<Play />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <footer>Piensa en voz alta. Juega en equipo.</footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
