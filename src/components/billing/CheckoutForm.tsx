"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { PlanId } from "@/lib/plans";

const CHECKOUT_FORM_CONTAINER_ID = "iyzipay-checkout-form";

// Injecting HTML that contains <script> tags via innerHTML does not execute them (browsers
// ignore script tags added this way) — iyzico's checkout form content is exactly that kind of
// snippet, so each script must be rebuilt as a real DOM node to actually run.
function injectCheckoutFormContent(container: HTMLElement, html: string) {
  container.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  Array.from(wrapper.childNodes).forEach((node) => {
    if (node.nodeName === "SCRIPT") {
      const oldScript = node as HTMLScriptElement;
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
      newScript.textContent = oldScript.textContent;
      container.appendChild(newScript);
    } else {
      container.appendChild(node.cloneNode(true));
    }
  });
}

interface CheckoutFormProps {
  plan: Exclude<PlanId, "free">;
}

export function CheckoutForm({ plan }: CheckoutFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formVisible, setFormVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [gsmNumber, setGsmNumber] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zipCode, setZipCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, name, surname, gsmNumber, identityNumber, address, city, zipCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Ödeme başlatılamadı.");
        return;
      }
      setFormVisible(false);
      requestAnimationFrame(() => {
        if (containerRef.current) {
          injectCheckoutFormContent(containerRef.current, data.checkoutFormContent);
        }
      });
    } catch {
      toast.error("Ödeme başlatılamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!formVisible) {
    return <div id={CHECKOUT_FORM_CONTAINER_ID} ref={containerRef} />;
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Input placeholder="Ad" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input placeholder="Soyad" value={surname} onChange={(e) => setSurname(e.target.value)} required />
      <Input
        placeholder="Telefon (5xxxxxxxxx)"
        value={gsmNumber}
        onChange={(e) => setGsmNumber(e.target.value)}
        required
      />
      <Input
        placeholder="TC Kimlik No"
        value={identityNumber}
        onChange={(e) => setIdentityNumber(e.target.value)}
        required
      />
      <Input
        placeholder="Adres"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        required
        className="sm:col-span-2"
      />
      <Input placeholder="Şehir" value={city} onChange={(e) => setCity(e.target.value)} required />
      <Input placeholder="Posta kodu (opsiyonel)" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
      <Button type="submit" disabled={submitting} className="sm:col-span-2">
        {submitting ? "Yönlendiriliyor…" : "Ödemeye geç"}
      </Button>
    </form>
  );
}
