"use client";

import { RotateCcw } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { formatMNT } from "@/lib/catalog";
import type { StoreSettings } from "@/lib/admin-data";
import { Button, ConfirmDialog, Input, Switch } from "@/components/ui";

interface SettingsViewProps {
  settings: StoreSettings;
  onSave: (settings: StoreSettings) => void;
  onResetDemoData: () => void;
}

export default function SettingsView({ settings, onSave, onResetDemoData }: SettingsViewProps) {
  const [draft, setDraft] = useState(settings);
  const [confirmReset, setConfirmReset] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const thresholdValid = Number.isInteger(draft.lowStockThreshold) && draft.lowStockThreshold >= 0;
  const deliveryValid = Number.isInteger(draft.freeDeliveryThreshold) && draft.freeDeliveryThreshold >= 0;
  const canSave = dirty && thresholdValid && deliveryValid && draft.storeName.trim() !== "";

  const set = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const toInt = (v: string) => (v.trim() === "" ? Number.NaN : Number(v.replace(/[\s,]/g, "")));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canSave) onSave({ ...draft, storeName: draft.storeName.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <SettingsGroup title="Дэлгүүрийн мэдээлэл" description="Хэрэглэгчдэд харагдах холбоо барих мэдээлэл.">
        <Input
          id="st-name"
          label="Дэлгүүрийн нэр"
          className="max-w-md"
          value={draft.storeName}
          onChange={(e) => set("storeName", e.target.value)}
        />
        <Input
          id="st-phone"
          label="Лавлах утас"
          className="max-w-md"
          value={draft.supportPhone}
          onChange={(e) => set("supportPhone", e.target.value)}
        />
        <Input
          id="st-email"
          label="Имэйл"
          type="email"
          className="max-w-md"
          value={draft.supportEmail}
          onChange={(e) => set("supportEmail", e.target.value)}
        />
      </SettingsGroup>

      <SettingsGroup title="Агуулах ба хүргэлт" description="Хяналтын панелийн анхааруулга болон хүргэлтийн нөхцөлд нөлөөлнө.">
        <Input
          id="st-threshold"
          label="Бага үлдэгдлийн босго"
          className="max-w-md"
          controlClassName="w-32 tabular-nums"
          inputMode="numeric"
          value={Number.isNaN(draft.lowStockThreshold) ? "" : draft.lowStockThreshold}
          onChange={(e) => set("lowStockThreshold", toInt(e.target.value))}
          hint={`${draft.lowStockThreshold} ширхэг ба түүнээс доош бол “Бага үлдэгдэл” гэж тэмдэглэнэ`}
          error={thresholdValid ? undefined : "0 эсвэл түүнээс их бүхэл тоо"}
        />
        <Input
          id="st-delivery"
          label="Үнэгүй хүргэлтийн доод дүн (₮)"
          className="max-w-md"
          controlClassName="w-40 tabular-nums"
          inputMode="numeric"
          value={Number.isNaN(draft.freeDeliveryThreshold) ? "" : draft.freeDeliveryThreshold}
          onChange={(e) => set("freeDeliveryThreshold", toInt(e.target.value))}
          hint={`${formatMNT(draft.freeDeliveryThreshold)}-өөс дээш захиалгад хүргэлт үнэгүй`}
          error={deliveryValid ? undefined : "0 эсвэл түүнээс их бүхэл тоо"}
        />
      </SettingsGroup>

      <SettingsGroup title="Мэдэгдэл">
        <Switch
          label="Шинэ захиалгын мэдэгдэл"
          description="Захиалга орж ирэхэд дуут дохио болон и-мэйл илгээнэ."
          checked={draft.notifyNewOrder}
          onCheckedChange={(v) => set("notifyNewOrder", v)}
        />
        <Switch
          label="Бага үлдэгдлийн анхааруулга"
          description="Үлдэгдэл босгоос доош ороход өдөр бүр 09:00-д тайлан илгээнэ."
          checked={draft.notifyLowStock}
          onCheckedChange={(v) => set("notifyLowStock", v)}
        />
      </SettingsGroup>

      <section className="rounded-lg border border-rose-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Демо өгөгдөл</h2>
        <p className="mt-1 text-sm text-slate-500">Бараа, захиалгын өөрчлөлтүүдийг цуцалж анхны жишээ өгөгдөл рүү буцаана.</p>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Анхны байдалд оруулах
        </button>
      </section>

      {/* Sticky save bar only appears with unsaved changes, so it never competes for attention otherwise. */}
      {dirty && (
        <div className="sticky bottom-4 z-10 flex animate-pop-in flex-col gap-3 rounded-lg border border-slate-200 bg-white/95 p-3 pl-5 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-700">Хадгалаагүй өөрчлөлт байна</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDraft(settings)}>
              Буцаах
            </Button>
            <Button type="submit" disabled={!canSave}>
              Хадгалах
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          onResetDemoData();
          setConfirmReset(false);
        }}
        title="Анхны байдалд оруулах уу?"
        description="Нэмсэн, зассан, устгасан бараа болон захиалгын төлөвийн бүх өөрчлөлт арилна. Тохиргоо хэвээр үлдэнэ."
        confirmLabel="Анхны байдалд оруулах"
      />
    </form>
  );
}

function SettingsGroup({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[16rem_1fr]">
      <div>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
