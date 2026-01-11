import { useState, useEffect } from "react";
import type { Node } from "reactflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

type Props = {
  node: Node;
  onUpdate: (data: any) => void;
  onClose: () => void;
};

export function DeviceConfigPanel({ node, onUpdate, onClose }: Props) {
  const [formData, setFormData] = useState({
    label: node.data.label || "",
    dockerImage: node.data.config?.dockerImage || "",
    services: node.data.config?.services || "",
    ports: node.data.config?.ports || "",
    credentials: node.data.config?.credentials || "",
    interfaces: node.data.config?.interfaces || "",
  });

  useEffect(() => {
    setFormData({
      label: node.data.label || "",
      dockerImage: node.data.config?.dockerImage || "",
      services: node.data.config?.services || "",
      ports: node.data.config?.ports || "",
      credentials: node.data.config?.credentials || "",
      interfaces: node.data.config?.interfaces || "",
    });
  }, [node]);

  const handleSave = () => {
    onUpdate({
      label: formData.label,
      config: {
        dockerImage: formData.dockerImage,
        services: formData.services,
        ports: formData.ports,
        credentials: formData.credentials,
        interfaces: formData.interfaces,
      },
    });
  };

  return (
    <div className="w-80 border-l bg-card overflow-y-auto">
      <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between z-10">
        <h3 className="font-semibold">Device Configuration</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <Label htmlFor="label">Device Name</Label>
          <Input
            id="label"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            placeholder="e.g., Web Server"
          />
        </div>

        {node.type !== "zone" && (
          <>
            <div>
              <Label htmlFor="dockerImage">Docker Image</Label>
              <Input
                id="dockerImage"
                value={formData.dockerImage}
                onChange={(e) => setFormData({ ...formData, dockerImage: e.target.value })}
                placeholder="e.g., ubuntu:22.04"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Container image to use for this device
              </p>
            </div>

            <div>
              <Label htmlFor="services">Services</Label>
              <Textarea
                id="services"
                value={formData.services}
                onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                placeholder="e.g., nginx, mysql, ssh"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Services running on this device (one per line)
              </p>
            </div>

            <div>
              <Label htmlFor="ports">Ports</Label>
              <Input
                id="ports"
                value={formData.ports}
                onChange={(e) => setFormData({ ...formData, ports: e.target.value })}
                placeholder="e.g., 80, 443, 22"
              />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated port numbers</p>
            </div>

            <div>
              <Label htmlFor="credentials">Credentials</Label>
              <Input
                id="credentials"
                value={formData.credentials}
                onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                placeholder="e.g., admin:password123"
              />
              <p className="text-xs text-muted-foreground mt-1">Format: username:password</p>
            </div>

            <div>
              <Label htmlFor="interfaces">Network Interfaces</Label>
              <Textarea
                id="interfaces"
                value={formData.interfaces}
                onChange={(e) => setFormData({ ...formData, interfaces: e.target.value })}
                placeholder="e.g., eth0: 192.168.1.10/24"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Interface configurations (one per line)
              </p>
            </div>
          </>
        )}

        <Button onClick={handleSave} className="w-full">
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
