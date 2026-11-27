"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { gazetteerData, findMatchingItem, type VillageItem } from "@/lib/gazetteer";

type AddressStep = "province" | "district" | "commune" | "village";

interface AddressCascadePickerProps {
  province: string;
  district: string;
  commune: string;
  village: string;
  houseNo: string;
  street: string;
  onSelectProvince: (val: string) => void;
  onSelectDistrict: (val: string) => void;
  onSelectCommune: (val: string) => void;
  onSelectVillage: (val: string) => void;
  onHouseNoChange: (val: string) => void;
  onStreetChange: (val: string) => void;
}

const PROVINCES_LIST = Object.keys(gazetteerData);

const STEP_META: Record<
  AddressStep,
  { num: number; kh: string; en: string; placeholder: string }
> = {
  province: {
    num: 1,
    kh: "ខេត្ត / រាជធានី",
    en: "Province",
    placeholder: "ស្វែងរកខេត្ត / Search province...",
  },
  district: {
    num: 2,
    kh: "ស្រុក / ខណ្ឌ / ក្រុង",
    en: "District",
    placeholder: "ស្វែងរកស្រុក ឬ ខណ្ឌ / Search district...",
  },
  commune: {
    num: 3,
    kh: "ឃុំ / សង្កាត់",
    en: "Commune",
    placeholder: "ស្វែងរកឃុំ ឬ សង្កាត់ / Search commune...",
  },
  village: {
    num: 4,
    kh: "ភូមិ",
    en: "Village",
    placeholder: "ស្វែងរកភូមិ / Search village...",
  },
};

export default function AddressCascadePicker({
  province,
  district,
  commune,
  village,
  houseNo,
  street,
  onSelectProvince,
  onSelectDistrict,
  onSelectCommune,
  onSelectVillage,
  onHouseNoChange,
  onStreetChange,
}: AddressCascadePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<AddressStep>("province");
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const matchedProvince = findMatchingItem(PROVINCES_LIST, province) || "";
  const availableDistricts = useMemo(
    () =>
      matchedProvince
        ? Object.keys(gazetteerData[matchedProvince]?.districts || {})
        : [],
    [matchedProvince]
  );
  const matchedDistrict = findMatchingItem(availableDistricts, district) || "";
  const availableCommunes = useMemo(
    () =>
      matchedProvince && matchedDistrict
        ? Object.keys(
            gazetteerData[matchedProvince]?.districts?.[matchedDistrict]?.communes || {}
          )
        : [],
    [matchedProvince, matchedDistrict]
  );
  const matchedCommune = findMatchingItem(availableCommunes, commune) || "";
  const availableVillages: VillageItem[] = useMemo(
    () =>
      matchedProvince && matchedDistrict && matchedCommune
        ? gazetteerData[matchedProvince]?.districts?.[matchedDistrict]?.communes?.[
            matchedCommune
          ]?.villages || []
        : [],
    [matchedProvince, matchedDistrict, matchedCommune]
  );
  const matchedVillage =
    findMatchingItem(
      availableVillages.map((v) => v.val),
      village
    ) || "";

  // Lock background scroll while sheet/modal is open & handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  // Reset search, scroll list to top, and focus search on desktop when step changes
  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    if (listRef.current) listRef.current.scrollTop = 0;
    const isCoarsePointer =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches;
    if (!isCoarsePointer) {
      const t = setTimeout(() => searchRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [isOpen, step]);

  const openAtStep = (requested: AddressStep) => {
    let target: AddressStep = requested;
    if (requested === "district" && !matchedProvince) {
      target = "province";
    } else if (requested === "commune") {
      if (!matchedProvince) target = "province";
      else if (!matchedDistrict) target = "district";
    } else if (requested === "village") {
      if (!matchedProvince) target = "province";
      else if (!matchedDistrict) target = "district";
      else if (!matchedCommune) target = "commune";
    }
    setStep(target);
    setSearch("");
    setIsOpen(true);
  };

  const handlePickProvince = (prov: string) => {
    onSelectProvince(prov);
    const nextDistricts = Object.keys(gazetteerData[prov]?.districts || {});
    if (nextDistricts.length > 0) {
      setStep("district");
    } else {
      setIsOpen(false);
    }
  };

  const handlePickDistrict = (dist: string) => {
    onSelectDistrict(dist);
    const nextCommunes = Object.keys(
      gazetteerData[matchedProvince]?.districts?.[dist]?.communes || {}
    );
    if (nextCommunes.length > 0) {
      setStep("commune");
    } else {
      setIsOpen(false);
    }
  };

  const handlePickCommune = (comm: string) => {
    onSelectCommune(comm);
    const nextVillages =
      gazetteerData[matchedProvince]?.districts?.[matchedDistrict]?.communes?.[comm]
        ?.villages || [];
    if (nextVillages.length > 0) {
      setStep("village");
    } else {
      setIsOpen(false);
    }
  };

  const handlePickVillage = (vil: string) => {
    onSelectVillage(vil);
    setIsOpen(false);
  };

  // Build filtered option list for the current step
  const options = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (step === "province") {
      return PROVINCES_LIST.map((p) => ({
        val: p,
        kh: p,
        en: gazetteerData[p]?.en || "",
        selected: p === matchedProvince,
      })).filter(
        (o) => !q || o.kh.toLowerCase().includes(q) || o.en.toLowerCase().includes(q)
      );
    }
    if (step === "district") {
      return availableDistricts
        .map((d) => ({
          val: d,
          kh: d,
          en: gazetteerData[matchedProvince]?.districts?.[d]?.en || "",
          selected: d === matchedDistrict,
        }))
        .filter(
          (o) => !q || o.kh.toLowerCase().includes(q) || o.en.toLowerCase().includes(q)
        );
    }
    if (step === "commune") {
      return availableCommunes
        .map((c) => ({
          val: c,
          kh: c,
          en:
            gazetteerData[matchedProvince]?.districts?.[matchedDistrict]?.communes?.[c]
              ?.en || "",
          selected: c === matchedCommune,
        }))
        .filter(
          (o) => !q || o.kh.toLowerCase().includes(q) || o.en.toLowerCase().includes(q)
        );
    }
    return availableVillages
      .map((v) => ({
        val: v.val,
        kh: v.val,
        en: v.label !== v.val ? v.label : "",
        selected: v.val === matchedVillage,
      }))
      .filter(
        (o) => !q || o.kh.toLowerCase().includes(q) || o.en.toLowerCase().includes(q)
      );
  }, [
    step,
    search,
    matchedProvince,
    matchedDistrict,
    matchedCommune,
    matchedVillage,
    availableDistricts,
    availableCommunes,
    availableVillages,
  ]);

  const handleOptionClick = (val: string) => {
    if (step === "province") handlePickProvince(val);
    else if (step === "district") handlePickDistrict(val);
    else if (step === "commune") handlePickCommune(val);
    else handlePickVillage(val);
  };

  const provinceEn = matchedProvince ? gazetteerData[matchedProvince]?.en : "";
  const districtEn =
    matchedProvince && matchedDistrict
      ? gazetteerData[matchedProvince]?.districts?.[matchedDistrict]?.en
      : "";
  const communeEn =
    matchedProvince && matchedDistrict && matchedCommune
      ? gazetteerData[matchedProvince]?.districts?.[matchedDistrict]?.communes?.[
          matchedCommune
        ]?.en
      : "";
  const villageObj = availableVillages.find((v) => v.val === matchedVillage);

  const canJumpTo = (s: AddressStep) => {
    if (s === "province") return true;
    if (s === "district") return Boolean(matchedProvince);
    if (s === "commune") return Boolean(matchedProvince && matchedDistrict);
    return Boolean(matchedProvince && matchedDistrict && matchedCommune);
  };

  const stepValue = (s: AddressStep) => {
    if (s === "province") return matchedProvince;
    if (s === "district") return matchedDistrict;
    if (s === "commune") return matchedCommune;
    return matchedVillage;
  };

  return (
    <>
      <div className="grid-3">
        <div className="form-group">
          <label>Province</label>
          <button
            type="button"
            className={`addr-trigger ${matchedProvince ? "has-value" : ""}`}
            onClick={() => openAtStep("province")}
          >
            <span className="addr-trigger-text">
              {matchedProvince
                ? `${matchedProvince}${provinceEn ? ` (${provinceEn})` : ""}`
                : "-- ជ្រើសរើស Province --"}
            </span>
            <span className="addr-trigger-chevron" aria-hidden="true">
              ▾
            </span>
          </button>
        </div>

        <div className="form-group">
          <label>District / Khan / Krong</label>
          <button
            type="button"
            className={`addr-trigger ${matchedDistrict ? "has-value" : ""} ${
              !matchedProvince ? "is-muted" : ""
            }`}
            onClick={() => openAtStep("district")}
          >
            <span className="addr-trigger-text">
              {matchedDistrict
                ? `${matchedDistrict}${districtEn ? ` (${districtEn})` : ""}`
                : matchedProvince
                ? "-- ជ្រើសរើស District --"
                : "-- សូមជ្រើសរើសខេត្តជាមុន --"}
            </span>
            <span className="addr-trigger-chevron" aria-hidden="true">
              ▾
            </span>
          </button>
        </div>

        <div className="form-group">
          <label>Commune / Sangkat</label>
          <button
            type="button"
            className={`addr-trigger ${matchedCommune ? "has-value" : ""} ${
              !matchedDistrict ? "is-muted" : ""
            }`}
            onClick={() => openAtStep("commune")}
          >
            <span className="addr-trigger-text">
              {matchedCommune
                ? `${matchedCommune}${communeEn ? ` (${communeEn})` : ""}`
                : matchedDistrict
                ? "-- ជ្រើសរើស Commune --"
                : "-- សូមជ្រើសរើសស្រុកជាមុន --"}
            </span>
            <span className="addr-trigger-chevron" aria-hidden="true">
              ▾
            </span>
          </button>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 14 }}>
        <div className="form-group">
          <label>Village</label>
          <button
            type="button"
            className={`addr-trigger ${matchedVillage ? "has-value" : ""} ${
              !matchedCommune ? "is-muted" : ""
            }`}
            onClick={() => openAtStep("village")}
          >
            <span className="addr-trigger-text">
              {matchedVillage
                ? villageObj?.label || matchedVillage
                : matchedCommune
                ? "-- ជ្រើសរើស Village --"
                : "-- សូមជ្រើសរើសឃុំជាមុន --"}
            </span>
            <span className="addr-trigger-chevron" aria-hidden="true">
              ▾
            </span>
          </button>
        </div>

        <div className="form-group">
          <label>House number (optional)</label>
          <input
            type="text"
            value={houseNo}
            placeholder="ឧ. 12"
            onChange={(e) => onHouseNoChange(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Street (optional)</label>
          <input
            type="text"
            value={street}
            placeholder="ឧ. ៧៦"
            onChange={(e) => onStreetChange(e.target.value)}
          />
        </div>
      </div>

      {isOpen && (
        <div
          className="addr-sheet-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className="addr-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="ជ្រើសរើសអាសយដ្ឋាន (Select Address)"
          >
            <div className="addr-sheet-handle" aria-hidden="true" />

            <div className="addr-sheet-header">
              <div>
                <div className="addr-sheet-title">
                  ជ្រើសរើស {STEP_META[step].kh}
                </div>
                <div className="addr-sheet-sub">
                  Step {STEP_META[step].num} of 4 — {STEP_META[step].en}
                </div>
              </div>
              <button
                type="button"
                className="addr-sheet-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Cascading step breadcrumbs */}
            <div className="addr-steps-bar">
              {(["province", "district", "commune", "village"] as AddressStep[]).map(
                (s, idx) => {
                  const active = step === s;
                  const val = stepValue(s);
                  const enabled = canJumpTo(s);
                  return (
                    <React.Fragment key={s}>
                      {idx > 0 && (
                        <span className="addr-step-arrow" aria-hidden="true">
                          ›
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={!enabled}
                        className={`addr-step-pill ${active ? "active" : ""} ${
                          val ? "filled" : ""
                        }`}
                        onClick={() => enabled && setStep(s)}
                      >
                        {val || STEP_META[s].en}
                      </button>
                    </React.Fragment>
                  );
                }
              )}
            </div>

            {/* Search input */}
            <div className="addr-search-wrap">
              <input
                ref={searchRef}
                type="text"
                className="addr-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={STEP_META[step].placeholder}
              />
              {search && (
                <button
                  type="button"
                  className="addr-search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Options list */}
            <div className="addr-options-list" ref={listRef}>
              {options.length === 0 ? (
                <div className="addr-empty">
                  រកមិនឃើញទិន្នន័យ (No matches found)
                </div>
              ) : (
                options.map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    className={`addr-option-row ${opt.selected ? "selected" : ""}`}
                    onClick={() => handleOptionClick(opt.val)}
                  >
                    <div className="addr-option-labels">
                      <span className="addr-option-kh">{opt.kh}</span>
                      {opt.en && <span className="addr-option-en">{opt.en}</span>}
                    </div>
                    <span className="addr-option-icon" aria-hidden="true">
                      {opt.selected ? "✓" : step === "village" ? "" : "›"}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="addr-sheet-footer">
              <span className="addr-sheet-count">{options.length} ជម្រើស</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsOpen(false)}
              >
                រួចរាល់ (Done)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
