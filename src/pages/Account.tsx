import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { pb } from "../pocketbase";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Save, Lock, Trash2, User } from "lucide-react";

export default function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Profile state
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name || "",
  );
  const [email, setEmail] = useState(user?.email || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Delete account state
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage(null);

    try {
      const updates: Record<string, string> = { name: displayName };
      if (email !== user?.email) {
        updates.email = email;
      }

      await pb.collection("users").update(user!.id, updates);

      setProfileMessage({
        type: "success",
        text:
          email !== user?.email
            ? "Profile updated. Check your new email for a confirmation link."
            : "Profile updated successfully.",
      });
    } catch (err) {
      setProfileMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update profile",
      });
    }

    setProfileSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({
        type: "error",
        text: "Password must be at least 8 characters.",
      });
      return;
    }

    setPasswordSaving(true);
    setPasswordMessage(null);

    try {
      await pb.collection("users").update(user!.id, {
        password: newPassword,
        passwordConfirm: newPassword,
        oldPassword: "", // PocketBase requires old password in some configs
      });

      setPasswordMessage({
        type: "success",
        text: "Password updated successfully.",
      });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update password",
      });
    }

    setPasswordSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await pb.collection("users").delete(user!.id);
      await signOut();
      navigate("/");
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Failed to delete account. Please contact support.",
      );
      setDeleting(false);
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Account</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 pt-0 max-w-2xl mx-auto w-full">
          {/* Preferences */}
          <div>
            <h2 className="text-xl font-semibold mb-1">Preferences</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Manage your profile information and security settings.
            </p>

            {/* Profile Information */}
            <Card className="mb-4">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">
                    Profile Information
                  </CardTitle>
                </div>
                <CardDescription>
                  Update your display name and email address.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="display-name">Display Name</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                {profileMessage && (
                  <p
                    className={`text-sm ${profileMessage.type === "success" ? "text-green-600" : "text-destructive"}`}
                  >
                    {profileMessage.text}
                  </p>
                )}

                <Button onClick={handleSaveProfile} disabled={profileSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {profileSaving ? "Saving…" : "Save Changes"}
                </Button>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Change Password</CardTitle>
                </div>
                <CardDescription>
                  Choose a strong password to keep your account secure.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                </div>

                {passwordMessage && (
                  <p
                    className={`text-sm ${passwordMessage.type === "success" ? "text-green-600" : "text-destructive"}`}
                  >
                    {passwordMessage.text}
                  </p>
                )}

                <Button
                  onClick={handleChangePassword}
                  disabled={passwordSaving || !newPassword || !confirmPassword}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {passwordSaving ? "Updating…" : "Update Password"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Danger Zone */}
          <div>
            <h2 className="text-xl font-semibold mb-1 text-destructive">
              Danger Zone
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Irreversible and destructive actions.
            </p>

            <Card className="border-destructive/50">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <CardTitle className="text-base text-destructive">
                    Delete Account
                  </CardTitle>
                </div>
                <CardDescription>
                  Permanently delete your account and all associated data. This
                  action cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog
                  open={deleteDialogOpen}
                  onOpenChange={setDeleteDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete My Account
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Delete Account
                      </DialogTitle>
                      <DialogDescription>
                        This will permanently delete your account, all your
                        receipts, payment methods, and team data. This action{" "}
                        <strong>cannot be undone</strong>.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                      <p className="text-sm text-muted-foreground">
                        Type{" "}
                        <span className="font-mono font-semibold text-foreground">
                          DELETE
                        </span>{" "}
                        to confirm.
                      </p>
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="Type DELETE to confirm"
                        className="font-mono"
                      />
                      {deleteError && (
                        <p className="text-sm text-destructive">
                          {deleteError}
                        </p>
                      )}
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDeleteDialogOpen(false);
                          setDeleteConfirmText("");
                          setDeleteError(null);
                        }}
                        disabled={deleting}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== "DELETE" || deleting}
                      >
                        {deleting ? "Deleting…" : "Permanently Delete Account"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
