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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Webhook, Trash2, Activity } from "lucide-react";

interface WebhookItem {
  id: string;
  url: string;
  status: "active" | "inactive";
  lastUsed: string | null;
  activity24h: number;
  environment: "production" | "sandbox";
  createdAt: string;
}

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState("");
  const [environment, setEnvironment] = useState<"production" | "sandbox">(
    "production",
  );
  const [urlError, setUrlError] = useState<string | null>(null);

  const resetForm = () => {
    setUrl("");
    setEnvironment("production");
    setUrlError(null);
  };

  const validateUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return "URL must start with http:// or https://";
      }
      return null;
    } catch {
      return "Please enter a valid URL";
    }
  };

  const handleSave = async () => {
    const error = validateUrl(url);
    if (error) {
      setUrlError(error);
      return;
    }
    setSaving(true);
    // Simulate async save
    await new Promise((r) => setTimeout(r, 400));
    const newWebhook: WebhookItem = {
      id: crypto.randomUUID(),
      url,
      status: "active",
      lastUsed: null,
      activity24h: 0,
      environment,
      createdAt: new Date().toISOString(),
    };
    setWebhooks((prev) => [newWebhook, ...prev]);
    setSaving(false);
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Webhooks</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
              <p className="text-sm text-muted-foreground mt-1">
                A webhook is when the app makes an HTTP POST request to your
                application's API whenever an event occurs.
              </p>
            </div>
            <Button
              className="w-full sm:w-auto"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New webhook
            </Button>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead>LAST USED</TableHead>
                  <TableHead>24H ACTIVITY</TableHead>
                  <TableHead>ENVIRONMENT</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted">
                          <Webhook className="h-6 w-6" />
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-foreground">
                            No webhooks yet
                          </p>
                          <p className="text-sm mt-1">
                            Create a webhook to be notified when an event
                            occurs.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setDialogOpen(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          New webhook
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  webhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-mono text-sm max-w-[320px] truncate">
                        {webhook.url}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            webhook.status === "active"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            webhook.status === "active"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : ""
                          }
                        >
                          {webhook.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {webhook.lastUsed
                          ? new Date(webhook.lastUsed).toLocaleString()
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Activity className="h-3.5 w-3.5" />
                          {webhook.activity24h}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {webhook.environment}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* New Webhook Dialog */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>New webhook</DialogTitle>
              <DialogDescription>
                Enter the URL that will receive HTTP POST requests when events
                occur.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="webhook-url">Endpoint URL</Label>
                <Input
                  id="webhook-url"
                  placeholder="https://example.com/webhook"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (urlError) setUrlError(null);
                  }}
                />
                {urlError && (
                  <p className="text-sm text-destructive">{urlError}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="webhook-env">Environment</Label>
                <Select
                  value={environment}
                  onValueChange={(v) =>
                    setEnvironment(v as "production" | "sandbox")
                  }
                >
                  <SelectTrigger id="webhook-env">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !url}>
                {saving ? "Saving..." : "Create webhook"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
