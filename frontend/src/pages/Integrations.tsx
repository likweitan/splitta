import { useCallback, useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  CheckCircle2,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Plug,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  create,
  readCollection,
  remove,
  services,
  testWebhook,
  update,
  webhookKey,
  type WebhookTestResult,
} from "@/lib/api";

interface WebhookItem {
  ID: string;
  name: string | null;
  url: string;
  active: boolean;
  onReceiptCreated: boolean;
  onItemsPaid: boolean;
  lastTriggeredAt: string | null;
  lastStatus: string | null;
}

interface WebhookForm {
  name: string;
  url: string;
  onItemsPaid: boolean;
  onReceiptCreated: boolean;
}

const EMPTY_FORM: WebhookForm = {
  name: "",
  url: "",
  onItemsPaid: true,
  onReceiptCreated: true,
};

const EVENT_OPTIONS = [
  {
    key: "onItemsPaid",
    label: "When someone pays",
    description: "Someone marks items as paid on a shared receipt.",
  },
  {
    key: "onReceiptCreated",
    label: "When a receipt is created",
    description: "You add a new receipt.",
  },
] as const;

function validateUrl(value: string) {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:") return "URL must start with https://";
    return null;
  } catch {
    return "Please enter a valid URL";
  }
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function Integrations() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WebhookForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, WebhookTestResult>
  >({});

  const loadWebhooks = useCallback(async () => {
    try {
      const data = await readCollection<WebhookItem>(
        `${services.receipt}/Webhooks?$orderby=createdAt desc`,
      );
      setWebhooks(data);
      setPageError(null);
    } catch (error) {
      setPageError(errorMessage(error, "Unable to load integrations."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWebhooks();
  }, [loadWebhooks]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (webhook: WebhookItem) => {
    setEditingId(webhook.ID);
    setForm({
      name: webhook.name ?? "",
      url: webhook.url,
      onItemsPaid: webhook.onItemsPaid,
      onReceiptCreated: webhook.onReceiptCreated,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const error = validateUrl(form.url);
    if (error) {
      setFormError(error);
      return;
    }
    if (!form.onItemsPaid && !form.onReceiptCreated) {
      setFormError("Select at least one event.");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      name: form.name.trim() || null,
      url: form.url.trim(),
    };
    try {
      if (editingId) {
        await update(webhookKey(editingId), payload);
      } else {
        await create(`${services.receipt}/Webhooks`, payload);
      }
      setDialogOpen(false);
      await loadWebhooks();
    } catch (err) {
      setFormError(errorMessage(err, "Unable to save the integration."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove(webhookKey(id));
      setWebhooks((prev) => prev.filter((w) => w.ID !== id));
    } catch (error) {
      setPageError(errorMessage(error, "Unable to delete the integration."));
    }
  };

  const handleToggleActive = async (webhook: WebhookItem) => {
    setTogglingId(webhook.ID);
    try {
      await update(webhookKey(webhook.ID), { active: !webhook.active });
      setWebhooks((prev) =>
        prev.map((w) =>
          w.ID === webhook.ID ? { ...w, active: !webhook.active } : w,
        ),
      );
    } catch (error) {
      setPageError(errorMessage(error, "Unable to update the integration."));
    } finally {
      setTogglingId(null);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await testWebhook(id);
      setTestResults((prev) => ({ ...prev, [id]: result }));
      await loadWebhooks();
    } catch (error) {
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          ok: false,
          status: 0,
          message: errorMessage(error, "Test failed."),
        },
      }));
    } finally {
      setTestingId(null);
    }
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
                  <BreadcrumbPage>Integrations</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Send receipt updates to Microsoft Teams or another webhook
                endpoint whenever an event occurs.
              </p>
            </div>
            <Button className="w-full sm:w-auto" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add integration
            </Button>
          </div>

          {pageError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {pageError}
            </p>
          )}

          {loading || webhooks.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>INTEGRATION</TableHead>
                    <TableHead>EVENTS</TableHead>
                    <TableHead>STATUS</TableHead>
                    <TableHead>LAST DELIVERY</TableHead>
                    <TableHead className="w-[160px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="flex justify-center py-16 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    webhooks.map((webhook) => {
                      const testResult = testResults[webhook.ID];
                      return (
                        <TableRow key={webhook.ID}>
                          <TableCell className="max-w-[320px]">
                            {webhook.name && (
                              <p className="font-medium truncate">
                                {webhook.name}
                              </p>
                            )}
                            <p className="font-mono text-xs text-muted-foreground truncate">
                              {webhook.url}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {webhook.onItemsPaid && (
                                <Badge variant="outline">Payment</Badge>
                              )}
                              {webhook.onReceiptCreated && (
                                <Badge variant="outline">Receipt created</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={webhook.active ? "default" : "secondary"}
                              className={
                                webhook.active
                                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                                  : ""
                              }
                            >
                              {webhook.active ? "active" : "paused"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {webhook.lastTriggeredAt ? (
                              <>
                                <p>
                                  {new Date(
                                    webhook.lastTriggeredAt,
                                  ).toLocaleString()}
                                </p>
                                <p className="text-xs">{webhook.lastStatus}</p>
                              </>
                            ) : (
                              "Never"
                            )}
                            {testResult && (
                              <p
                                className={`mt-1 flex items-center gap-1 text-xs ${
                                  testResult.ok
                                    ? "text-green-700"
                                    : "text-destructive"
                                }`}
                              >
                                {testResult.ok ? (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5" />
                                )}
                                Test: {testResult.message}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTest(webhook.ID)}
                                disabled={testingId === webhook.ID}
                              >
                                {testingId === webhook.ID ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                ) : (
                                  <Send className="h-3.5 w-3.5 mr-1.5" />
                                )}
                                Test
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                                aria-label={
                                  webhook.active
                                    ? "Pause integration"
                                    : "Resume integration"
                                }
                                title={
                                  webhook.active
                                    ? "Pause integration"
                                    : "Resume integration"
                                }
                                disabled={togglingId === webhook.ID}
                                onClick={() => handleToggleActive(webhook)}
                              >
                                {webhook.active ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                                aria-label="Edit integration"
                                onClick={() => openEdit(webhook)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                aria-label="Delete integration"
                                onClick={() => handleDelete(webhook.ID)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border py-16 gap-3 text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted">
                <Plug className="h-6 w-6" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">
                  No integrations yet
                </p>
                <p className="text-sm mt-1">
                  Connect an integration to receive receipt updates in Teams.
                </p>
              </div>
              <Button variant="outline" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add integration
              </Button>
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit integration" : "Add integration"}
              </DialogTitle>
              <DialogDescription>
                In Microsoft Teams, create an incoming webhook in Workflows,
                then paste its URL here.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="webhook-name">Name (optional)</Label>
                <Input
                  id="webhook-name"
                  placeholder="Lunch group channel"
                  maxLength={120}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  placeholder="https://….webhook.office.com/…"
                  value={form.url}
                  onChange={(e) => {
                    setForm({ ...form, url: e.target.value });
                    if (formError) setFormError(null);
                  }}
                />
              </div>
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-medium">
                  Send updates
                </legend>
                {EVENT_OPTIONS.map((option) => (
                  <div key={option.key} className="flex items-start gap-3">
                    <Checkbox
                      id={`webhook-${option.key}`}
                      className="mt-0.5"
                      checked={form[option.key]}
                      onCheckedChange={(checked) => {
                        setForm({ ...form, [option.key]: checked === true });
                        if (formError) setFormError(null);
                      }}
                    />
                    <Label
                      htmlFor={`webhook-${option.key}`}
                      className="flex flex-col gap-0.5 font-normal"
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </Label>
                  </div>
                ))}
              </fieldset>
              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !form.url}>
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Create integration"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
