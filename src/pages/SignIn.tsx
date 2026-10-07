import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { pb } from "../pocketbase";
import { LoginForm } from "@/components/login-form";

const SignIn = () => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      await pb.collection("users").authWithPassword(email, password);
      navigate("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message || "Authentication failed");
      } else {
        setErrorMsg("Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm
          onSubmit={handleSubmit}
          onSignupClick={() => navigate("/sign-up")}
          loading={loading}
          errorMsg={errorMsg}
        />
      </div>
    </div>
  );
};

export default SignIn;
