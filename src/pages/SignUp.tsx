import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { pb } from "../pocketbase";
import { SignupForm } from "@/components/signup-form";

const SignUp = () => {
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
    const confirmPassword = formData.get("confirm-password") as string;
    const name = formData.get("name") as string;

    try {
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      await pb.collection("users").create({
        email,
        emailVisibility: true,
        password,
        passwordConfirm: confirmPassword,
        name,
      });

      // Auto-login after signup
      await pb.collection("users").authWithPassword(email, password);
      navigate("/onboarding");
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const pbErr = err as {
          response: {
            message?: string;
            data?: Record<string, { message: string }>;
          };
        };
        const fieldErrors = pbErr.response?.data;
        if (fieldErrors) {
          const firstField = Object.values(fieldErrors)[0];
          setErrorMsg(
            firstField?.message ||
              pbErr.response?.message ||
              "Registration failed",
          );
        } else {
          setErrorMsg(pbErr.response?.message || "Registration failed");
        }
      } else if (err instanceof Error) {
        setErrorMsg(err.message || "Registration failed");
      } else {
        setErrorMsg("Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <SignupForm
          onSubmit={handleSubmit}
          onLoginClick={() => navigate("/sign-in")}
          loading={loading}
          errorMsg={errorMsg}
        />
      </div>
    </div>
  );
};

export default SignUp;
