import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "./lib/supabase";
import { installAuthDebug } from "./lib/auth-debug";

// Temporary: install auth debugger to diagnose mobile session drops
installAuthDebug(supabase);

createRoot(document.getElementById("root")!).render(<App />);
