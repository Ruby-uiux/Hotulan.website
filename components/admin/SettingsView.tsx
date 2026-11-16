"use client";

import { RotateCcw } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { formatMNT } from "@/lib/catalog";
import type { StoreSettings } from "@/lib/admin-data";
import { Modal, btn, inputClass } from "./ui";

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
        <Row label="Дэлгүүрийн нэр" htmlFor="st-name">
          <input id="st-name" value={draft.storeName} onChange={(e) => set("storeName", e.target.value)} className={inputClass} />
        </Row>
        <Row label="Лавлах утас" htmlFor="st-phone">
          <input id="st-phone" value={draft.supportPhone} onChange={(e) => set("supportPhone", e.target.value)} className={inputClass} />
        </Row>
        <Row label="Имэйл" htmlFor="st-email">
          <input id="st-email" type="email" value={draft.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} className={inputClass} />
        </Row>
      </SettingsGroup>

      <SettingsGroup title="Агуулах ба хүргэлт" description="Хяналтын панелийн анхааруулга болон хүргэлтийн нөхцөлд нөлөөлнө.">
        <Row
          label="Бага үлдэгдлийн босго"
          htmlFor="st-threshold"
          hint={thresholdValid ? `${draft.lowStockThreshold} ширхэг ба түүнээс доош бол “Бага үлдэгдэл” гэж тэмдэглэнэ` : "0 эсвэл түүнээс их бүхэл тоо"}
          error={!thresholdValid}
        >
          <input
            id="st-threshold"
            inputMode="numeric"
            value={Number.isNaN(draft.lowStockThreshold) ? "" : draft.lowStockThreshold}
            onChange={(e) => set("lowStockThreshold", toInt(e.target.value))}
            aria-invalid={!thresholdValid}
            className={`${inputClass} w-32 tabular-nums`}
          />
        </Row>
        <Row
          label="Үнэгүй хүргэлтийн доод дүн (₮)"
          htmlFor="st-delivery"
          hint={deliveryValid ? `${formatMNT(draft.freeDeliveryThreshold)}-өөс дээш захиалгад хүргэлт үнэгүй` : "0 эсвэл түүнээс их бүхэл тоо"}
          error={!deliveryValid}
        >
          <input
            id="st-delivery"
            inputMode="numeric"
            value={Number.isNaN(draft.freeDeliveryThreshold) ? "" : draft.freeDeliveryThreshold}
            onChange={(e) => set("freeDeliveryThreshold", toInt(e.target.value))}
            aria-invalid={!deliveryValid}
            className={`${inputClass} w-40 tabular-nums`}
          />
        </Row>
      </SettingsGroup>

      <SettingsGroup title="Мэдэгдэл">
        <Toggle
          label="Шинэ захиалгын мэдэгдэл"
          description="Захиалга орж ирэхэд дуут дохио болон и-мэйл илгээнэ."
          checked={draft.notifyNewOrder}
          onChange={(v) => set("notifyNewOrder", v)}
        />
        <Toggle
          label="Бага үлдэгдлийн анхааруулга"
          description="Үлдэгдэл босгоос доош ороход өдөр бүр 09:00-д тайлан илгээнэ."
          checked={draft.notifyLowStock}
          onChange={(v) => set("notifyLowStock", v)}
        />
      </SettingsGroup>

      <section className="rounded-xl border border-rose-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Демо өгөгдөл</h2>
        <p className="mt-1 text-sm text-slate-500">Бараа, захиалгын өөрчлөлтүүдийг цуцалж анхны жишээ өгөгдөл рүү буцаана.</p>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Анхны байдалд оруулах
        </button>
      </section>

      {/* Sticky save bar only appears with unsaved changes, so it never competes for attention otherwise. */}
      {dirty && (
        <div className="sticky bottom-4 z-10 flex animate-pop-in flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 pl-5 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-700">Хадгалаагүй өөрчлөлт байна</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft(settings)} className={btn.secondary}>
              Буцаах
            </button>
            <button type="submit" disabled={!canSave} className={btn.primary}>
              Хадгалах
            </button>
          </div>
        </div>
      )}

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        size="sm"
        title="Анхны байдалд оруулах уу?"
        footer={
          <>
            <button type="button" data-autofocus onClick={() => setConfirmReset(false)} className={btn.secondary}>
              Болих
            </button>
            <button
              type="button"
              onClick={() => {
                onResetDemoData();
                setConfirmReset(false);
              }}
              className={btn.danger}
            >
              Анхны байдалд оруулах
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Нэмсэн, зассан, устгасан бараа болон захиалгын төлөвийн бүх өөрчлөлт арилна. Тохиргоо хэвээр үлдэнэ.
        </p>
      </Modal>
    </form>
  );
}

function SettingsGroup({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[16rem_1fr]">
      <div>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="max-w-md">
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && <p className={`mt-1 text-xs ${error ? "font-medium text-rose-600" : "text-slate-500"}`}>{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6">
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="block text-sm text-slate-500">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${checked ? "left-[1.375rem]" : "left-0.5"}`}
        />
      </button>
    </label>
  );
}
