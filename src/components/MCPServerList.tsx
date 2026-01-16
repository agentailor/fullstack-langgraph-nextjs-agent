"use client";

import { useState, useEffect } from "react";
import { X, Plus, Edit, Trash2, Server, Globe, Loader2, RefreshCcw, Link2 } from "lucide-react";
import { MCPServerForm } from "./MCPServerForm";
import { OAuthStatusBadge, type OAuthStatusType } from "./OAuthStatusBadge";
import { MCPServerType } from "@/types/mcp";
import { useQueryClient } from "@tanstack/react-query";
import { OAuthStatus } from "@/lib/mcp/oauth-detection";

interface MCPServer {
  id: string;
  name: string;
  type: MCPServerType;
  enabled: boolean;
  command?: string;
  args?: unknown[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  // OAuth fields
  requiresAuth?: boolean;
  oauthStatus?: OAuthStatusType;
  createdAt: string;
  updatedAt: string;
}

interface MCPServerListProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MCPServerList({ isOpen, onClose }: MCPServerListProps) {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const fetchServers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/mcp-servers");
      if (response.ok) {
        const data = await response.json();
        setServers(data);
      }
    } catch (error) {
      console.error("Failed to fetch MCP servers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchServers();
    }
  }, [isOpen]);

  const toggleServer = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch("/api/mcp-servers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      if (response.ok) {
        setServers(servers.map((s) => (s.id === id ? { ...s, enabled } : s)));
        // Invalidate MCP tools cache to reload tools after server toggle
        queryClient.invalidateQueries({ queryKey: ["mcp-tools"] });
      }
    } catch (error) {
      console.error("Failed to toggle server:", error);
    }
  };

  const deleteServer = async (id: string, serverName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the MCP server "${serverName}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/mcp-servers?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setServers(servers.filter((s) => s.id !== id));
        // Invalidate MCP tools cache to reload tools after server deletion
        queryClient.invalidateQueries({ queryKey: ["mcp-tools"] });
      }
    } catch (error) {
      console.error("Failed to delete server:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const checkAndConnectOAuth = async (serverId: string) => {
    setConnectingId(serverId);
    try {
      const response = await fetch(`/api/oauth/check/${serverId}`);
      const data = await response.json();

      if (data.authorizationUrl) {
        // Store current path to return after OAuth
        sessionStorage.setItem("oauth_return_path", window.location.pathname);
        // Redirect to OAuth authorization
        window.location.href = data.authorizationUrl;
      } else if (data.error) {
        console.error("[OAuth] Error from API:", data.error);
      } else {
        // Update local state with OAuth status
        setServers((prevServers) =>
          prevServers.map((s) => {
            if (s.id !== serverId) return s;
            let newStatus: OAuthStatusType;
            if (data.connected) {
              newStatus = OAuthStatus.CONNECTED;
            } else if (s.oauthStatus === OAuthStatus.REQUIRED) {
              // Preserve REQUIRED status if we are still not connected
              newStatus = OAuthStatus.REQUIRED;
            } else {
              newStatus = OAuthStatus.NOT_REQUIRED;
            }
            return {
              ...s,
              oauthStatus: newStatus,
            };
          }),
        );
        // Invalidate MCP tools cache if connected
        if (data.connected) {
          queryClient.invalidateQueries({ queryKey: ["mcp-tools"] });
        }
      }
    } catch (error) {
      console.error("[OAuth] Failed to check/connect OAuth:", error);
    } finally {
      setConnectingId(null);
    }
  };

  const handleFormSaved = () => {
    fetchServers();
    setShowForm(false);
    setEditingServer(undefined);
    // Invalidate MCP tools cache to reload tools after server addition/edit
    queryClient.invalidateQueries({ queryKey: ["mcp-tools"] });
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingServer(undefined);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 p-4">
            <h2 className="text-lg font-semibold text-gray-900">MCP Servers</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowForm(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Add Server
              </button>
              <button
                onClick={fetchServers}
                disabled={loading}
                className="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-sm text-gray-600 transition-colors hover:text-gray-800"
                title="Refresh"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCcw size={16} />
                )}
              </button>
              <button
                onClick={onClose}
                className="cursor-pointer text-gray-400 transition-colors hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="max-h-[calc(90vh-120px)] overflow-y-auto p-4">
            {loading && servers.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            ) : servers.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <Server size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No MCP servers configured</p>
                <p className="text-sm">Add your first MCP server to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {servers.map((server) => (
                  <div
                    key={server.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {server.type === "stdio" ? (
                          <Server size={20} className="text-primary" />
                        ) : (
                          <Globe size={20} className="text-green-500" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900">{server.name}</h3>
                            {server.type === "http" && (
                              <OAuthStatusBadge status={server.oauthStatus} />
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            <span className="mr-2 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs">
                              {server.type}
                            </span>
                            {server.type === "stdio" ? (
                              <span>{server.command}</span>
                            ) : (
                              <span>{server.url}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Connect button for HTTP servers that require OAuth */}
                      {server.type === "http" &&
                        (server.oauthStatus === "REQUIRED" ||
                          server.oauthStatus === "EXPIRED" ||
                          server.oauthStatus === "UNKNOWN") && (
                          <button
                            onClick={() => checkAndConnectOAuth(server.id)}
                            disabled={connectingId === server.id}
                            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-blue-500 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Connect with OAuth"
                          >
                            {connectingId === server.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Link2 size={14} />
                            )}
                            Connect
                          </button>
                        )}

                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={server.enabled}
                          onChange={(e) => toggleServer(server.id, e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="peer peer-checked:bg-primary peer-focus:ring-ring/40 h-5 w-9 rounded-full bg-gray-200 peer-focus:ring-4 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                      </label>

                      <button
                        onClick={() => {
                          setEditingServer(server);
                          setShowForm(true);
                        }}
                        className="cursor-pointer p-1.5 text-gray-400 transition-colors hover:text-gray-600"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>

                      <button
                        onClick={() => deleteServer(server.id, server.name)}
                        disabled={deletingId === server.id}
                        className="cursor-pointer p-1.5 text-red-400 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === server.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <MCPServerForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSaved={handleFormSaved}
        server={editingServer}
      />
    </>
  );
}
