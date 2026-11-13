"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Branch,
  Agent,
  ContractRecord,
  Settings,
  TagRef,
  ContractFormPayload,
  EQUIPMENT_PRICES,
  detectBranchFromCode,
  agentBranchCode,
  directorBodyName,
  KHMER_TO_ENGLISH_PROVINCE,
} from "@/lib/shared";
import { composeKhmerAddress } from "@/lib/khmer";
import gazetteerDataRaw from "@/lib/gazetteer.json";
import { GazetteerType, findMatchingItem } from "@/lib/gazetteer";

const gazetteerData: GazetteerType = gazetteerDataRaw;
const PROVINCES_LIST = Object.keys(gazetteerData);

interface InitialData {
  today: string;
  branches: Branch[];
  settings: Settings;
  tag_reference: { new_template: TagRef[]; old_template: TagRef[] };
  recent_contracts: ContractRecord[];
  agents: Agent[];
  agents_count: number;
}

export default function ContractApp({ initialData }: { initialData: InitialData }) {
  const [activeTab, setActiveTab] = useState<string>("home");
  const [templateType, setTemplateType] = useState<"NEW" | "OLD">("NEW");
  const [contractLang, setContractLang] = useState<"kh" | "en">("kh");

  // State caches
  const [branches, setBranches] = useState<Branch[]>(initialData.branches || []);
  const [agents, setAgents] = useState<Agent[]>(initialData.agents || []);
  const [recentContracts, setRecentContracts] = useState<ContractRecord[]>(
    initialData.recent_contracts || []
  );
  const [settings, setSettings] = useState<Settings>(initialData.settings);
  const [today, setToday] = useState<string>(initialData.today || "");

  // Status banner
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Form Fields
  const [branchCode, setBranchCode] = useState<string>(branches[0]?.code || "MONA");
  const [contractNo, setContractNo] = useState<string>(branches[0]?.next_contract_no || "MONA011");
  const [contractDate, setContractDate] = useState<string>(initialData.today || "");
  const [datePreview, setDatePreview] = useState<string>("");
  const [digitStyle, setDigitStyle] = useState<"khmer" | "latin">("khmer");
  const [agentId, setAgentId] = useState<number | null>(null);

  // Party B
  const [agentTitle, setAgentTitle] = useState<string>("លោក");
  const [nameKh, setNameKh] = useState<string>("");
  const [nameLatin, setNameLatin] = useState<string>("");
  const [idNumber, setIdNumber] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  // Address
  const [addressMode, setAddressMode] = useState<"dropdown" | "manual">("dropdown");
  const [locationMatchesResidence, setLocationMatchesResidence] = useState<boolean>(true);
  const [houseNo, setHouseNo] = useState<string>("");
  const [street, setStreet] = useState<string>("");
  const [village, setVillage] = useState<string>("");
  const [commune, setCommune] = useState<string>("");
  const [district, setDistrict] = useState<string>("");
  const [province, setProvince] = useState<string>("");
  const [addressFull, setAddressFull] = useState<string>("");

  // Bank
  const [bankName, setBankName] = useState<string>("eMoney");
  const [bankAccountName, setBankAccountName] = useState<string>("");
  const [bankAccountNo, setBankAccountNo] = useState<string>("");

  // Equipment & Fixed Deposit
  const [fixedDeposit, setFixedDeposit] = useState<number>(50);
  const [eqPrinter, setEqPrinter] = useState<boolean>(false);
  const [eqScale, setEqScale] = useState<boolean>(false);
  const [eqBasket, setEqBasket] = useState<boolean>(false);

  // Company (Old template)
  const [companyName, setCompanyName] = useState<string>("");
  const [companyLaw, setCompanyLaw] = useState<string>("");
  const [companyRegNo, setCompanyRegNo] = useState<string>("");
  const [companyRegDate, setCompanyRegDate] = useState<string>("");
  const [companyTaxNo, setCompanyTaxNo] = useState<string>("");
  const [companyAddress, setCompanyAddress] = useState<string>("");

  // Popup & Search
  const [popupOpen, setPopupOpen] = useState<boolean>(false);
  const [popupFilter, setPopupFilter] = useState<string>("");
  const [showAllPopupBranches, setShowAllPopupBranches] = useState<boolean>(false);
  const [agentSearchQuery, setAgentSearchQuery] = useState<string>("");
  const [searchedAgents, setSearchedAgents] = useState<Agent[]>(agents);

  // Branches Admin Form
  const [bCode, setBCode] = useState<string>("");
  const [bProvKh, setBProvKh] = useState<string>("");
  const [bDirKh, setBDirKh] = useState<string>("");
  const [bDirLatin, setBDirLatin] = useState<string>("");
  const [bFormat, setBFormat] = useState<"khmer" | "latin">("khmer");
  const [bSeq, setBSeq] = useState<number>(1);

  // Direct Agent Form
  const [agEditId, setAgEditId] = useState<number | null>(null);
  const [agBranch, setAgBranch] = useState<string>(branches[0]?.code || "MONA");
  const [agCode, setAgCode] = useState<string>("");
  const [agNameKh, setAgNameKh] = useState<string>("");
  const [agNameLatin, setAgNameLatin] = useState<string>("");
  const [agIdNo, setAgIdNo] = useState<string>("");
  const [agPhone, setAgPhone] = useState<string>("");
  const [agBankName, setAgBankName] = useState<string>("eMoney");
  const [agBankNo, setAgBankNo] = useState<string>("");
  const [agAddr, setAgAddr] = useState<string>("");
  const [dbAgentSearch, setDbAgentSearch] = useState<string>("");

  // Preview panel
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewTab, setPreviewTab] = useState<"kh" | "en">("kh");
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [generateLoading, setGenerateLoading] = useState<boolean>(false);

  const latinManuallyEdited = useRef<boolean>(false);
  const bankAccountManuallyEdited = useRef<boolean>(false);
  const addressManuallyEdited = useRef<boolean>(false);

  const showStatus = (text: string, isError = false) => {
    setStatusMsg({ text, isError });
    setTimeout(() => setStatusMsg(null), 7000);
  };

  const selectedBranchObj = branches.find((b) => b.code === branchCode) || branches[0];

  // Auto-compose address full
  const syncAddressFull = (overrideParts?: Partial<{
    house_no: string;
    street: string;
    village: string;
    commune: string;
    district: string;
    province: string;
  }>) => {
    addressManuallyEdited.current = false;
    const comp = composeKhmerAddress({
      house_no: overrideParts?.house_no !== undefined ? overrideParts.house_no : houseNo,
      street: overrideParts?.street !== undefined ? overrideParts.street : street,
      village: overrideParts?.village !== undefined ? overrideParts.village : village,
      commune: overrideParts?.commune !== undefined ? overrideParts.commune : commune,
      district: overrideParts?.district !== undefined ? overrideParts.district : district,
      province: overrideParts?.province !== undefined ? overrideParts.province : province,
    });
    setAddressFull(comp);
  };

  const handleAddressPartChange = (
    field: "houseNo" | "street" | "village" | "commune" | "district" | "province",
    value: string
  ) => {
    let nextHouse = houseNo;
    let nextStreet = street;
    let nextVillage = village;
    let nextCommune = commune;
    let nextDistrict = district;
    let nextProvince = province;

    if (field === "houseNo") { setHouseNo(value); nextHouse = value; }
    else if (field === "street") { setStreet(value); nextStreet = value; }
    else if (field === "village") { setVillage(value); nextVillage = value; }
    else if (field === "commune") { setCommune(value); nextCommune = value; }
    else if (field === "district") { setDistrict(value); nextDistrict = value; }
    else if (field === "province") { setProvince(value); nextProvince = value; }

    syncAddressFull({
      house_no: nextHouse,
      street: nextStreet,
      village: nextVillage,
      commune: nextCommune,
      district: nextDistrict,
      province: nextProvince,
    });
  };

  // Gazetteer address cascading
  const matchedProvince = findMatchingItem(PROVINCES_LIST, province) || "";
  const availableDistricts = matchedProvince
    ? Object.keys(gazetteerData[matchedProvince]?.districts || {})
    : [];
  const matchedDistrict = findMatchingItem(availableDistricts, district) || "";
  const availableCommunes = matchedProvince && matchedDistrict
    ? Object.keys(gazetteerData[matchedProvince]?.districts?.[matchedDistrict]?.communes || {})
    : [];
  const matchedCommune = findMatchingItem(availableCommunes, commune) || "";
  const availableVillages = matchedProvince && matchedDistrict && matchedCommune
    ? (gazetteerData[matchedProvince]?.districts?.[matchedDistrict]?.communes?.[matchedCommune]?.villages || [])
    : [];
  const matchedVillage = findMatchingItem(availableVillages.map((v) => v.val), village) || "";

  const handleProvinceSelect = (newProv: string) => {
    setProvince(newProv);
    setDistrict("");
    setCommune("");
    setVillage("");
    syncAddressFull({
      province: newProv,
      district: "",
      commune: "",
      village: "",
    });
  };

  const handleDistrictSelect = (newDist: string) => {
    setDistrict(newDist);
    setCommune("");
    setVillage("");
    syncAddressFull({
      district: newDist,
      commune: "",
      village: "",
    });
  };

  const handleCommuneSelect = (newComm: string) => {
    setCommune(newComm);
    setVillage("");
    syncAddressFull({
      commune: newComm,
      village: "",
    });
  };

  const handleVillageSelect = (newVil: string) => {
    setVillage(newVil);
    syncAddressFull({
      village: newVil,
    });
  };

  useEffect(() => {
    if (!addressManuallyEdited.current) {
      const comp = composeKhmerAddress({
        house_no: houseNo,
        street: street,
        village: village,
        commune: commune,
        district: district,
        province: province,
      });
      setAddressFull(comp);
    }
  }, [houseNo, street, village, commune, district, province]);

  // Transliterate date preview
  useEffect(() => {
    if (!contractDate) return;
    fetch(`/api/transliterate?date_str=${encodeURIComponent(contractDate)}&template_type=${templateType}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.date_info) setDatePreview(d.date_info.full_preview);
      })
      .catch(() => {});
  }, [contractDate, templateType]);

  const onKhmerNameChange = (val: string) => {
    setNameKh(val);
    fetch(`/api/transliterate?name_kh=${encodeURIComponent(val)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!latinManuallyEdited.current) {
          setNameLatin(d.name_latin || "");
          if (!bankAccountManuallyEdited.current) {
            setBankAccountName(d.name_latin || "");
          }
        }
      });
  };

  const onContractNoChange = (val: string) => {
    setContractNo(val);
    setPopupFilter(val);
    const det = detectBranchFromCode(val, branches);
    if (det && det !== branchCode && branches.some((b) => b.code === det)) {
      setBranchCode(det);
    }
    if (templateType === "OLD") {
      const exact = agents.find((ag) => ag.agent_code?.toUpperCase() === val.trim().toUpperCase());
      if (exact) {
        fillFormFromAgent(exact, false);
      }
    }
  };

  const onBranchChange = (code: string) => {
    setBranchCode(code);
    const b = branches.find((x) => x.code === code);
    if (!b) return;

    if (templateType === "OLD") {
      const bAgents = agents.filter((ag) => agentBranchCode(ag, branches) === code);
      if (bAgents.length > 0) {
        fillFormFromAgent(bAgents[0], true);
      } else {
        setContractNo(b.next_contract_no || `${b.code}001`);
      }
    } else {
      setContractNo(b.next_contract_no || `${b.code}001`);
      if (!province || province !== b.province_kh) {
        setProvince(b.province_kh);
      }
    }
  };

  const openContractFlow = (type: "NEW" | "OLD", lang?: "kh" | "en") => {
    setTemplateType(type);
    if (lang) setContractLang(lang);
    setActiveTab("form");
    setPreviewData(null);
    setDigitStyle(type === "OLD" ? settings.old_digit_style : settings.new_digit_style);

    if (type === "OLD") {
      setEqPrinter(true);
    } else {
      setEqPrinter(false);
    }
    if (!contractDate) setContractDate(today);

    const b = branches.find((x) => x.code === branchCode) || branches[0];
    if (b) {
      if (type === "NEW") {
        setContractNo(b.next_contract_no || `${b.code}001`);
      }
    }
  };

  const fillFormFromAgent = (ag: Agent, closePopup = true) => {
    latinManuallyEdited.current = true;
    bankAccountManuallyEdited.current = true;
    addressManuallyEdited.current = Boolean(ag.address_full);
    setAgentId(ag.id || null);

    const agCodeVal = (ag.agent_code || "").trim();
    if (agCodeVal) setContractNo(agCodeVal);

    const agBr = agentBranchCode(ag, branches);
    if (agBr && branches.some((b) => b.code === agBr)) {
      setBranchCode(agBr);
    }

    setNameKh(ag.name_kh || "");
    setNameLatin(ag.name_latin || "");
    setIdNumber(ag.id_number || "");
    setPhone(ag.phone || "");
    setEmail(ag.email || "");
    setHouseNo(ag.house_no || "");
    setStreet(ag.street || "");
    setVillage(ag.village || "");
    setCommune(ag.commune || "");
    setDistrict(ag.district || "");
    setProvince(ag.province || "");
    setAddressFull(ag.address_full || "");
    setBankName(ag.bank_name || "eMoney");
    setBankAccountName(ag.bank_account_name || ag.name_latin || "");
    setBankAccountNo(ag.bank_account_no || "");
    setCompanyName(ag.company_name || "");
    setCompanyLaw(ag.company_law || "");
    setCompanyRegNo(ag.company_reg_no || "");
    setCompanyRegDate(ag.company_reg_date || "");
    setCompanyTaxNo(ag.company_tax_no || "");
    setCompanyAddress(ag.company_address || "");

    if (closePopup) setPopupOpen(false);
    showStatus(`បានទាញយកព័ត៌មានភ្នាក់ងារ «${ag.name_kh}» (កូដភ្នាក់ងារ៖ ${agCodeVal || "-"}) រួចរាល់។`);
  };

  const resetForm = () => {
    latinManuallyEdited.current = false;
    bankAccountManuallyEdited.current = false;
    addressManuallyEdited.current = false;
    setAgentId(null);
    setNameKh("");
    setNameLatin("");
    setIdNumber("");
    setPhone("");
    setEmail("");
    setHouseNo("");
    setStreet("");
    setVillage("");
    setCommune("");
    setDistrict("");
    setProvince("");
    setAddressFull("");
    setBankName("eMoney");
    setBankAccountName("");
    setBankAccountNo("");
    setCompanyName("");
    setCompanyLaw("");
    setCompanyRegNo("");
    setCompanyRegDate("");
    setCompanyTaxNo("");
    setCompanyAddress("");
    setEqPrinter(templateType === "OLD");
    setEqScale(false);
    setEqBasket(false);
    setFixedDeposit(50);

    const b = branches.find((x) => x.code === branchCode) || branches[0];
    if (b) {
      setContractNo(b.next_contract_no || `${b.code}001`);
    }
  };

  const loadSamplePreset = (type: "NEW" | "OLD") => {
    openContractFlow(type);
    addressManuallyEdited.current = false;
    if (type === "NEW") {
      setBranchCode("MONA");
      setContractDate("19/10/2026");
      setContractNo("MONA011");
      setNameKh("ប៉ា ចំរើន");
      setNameLatin("Pa Chamroun");
      setIdNumber("230067812");
      setPhone("060363691");
      setStreet("៧៦");
      setVillage("ពូហ្យាម");
      setCommune("សែនមនោរម្យ");
      setDistrict("អូរាំង");
      setProvince("មណ្ឌលគិរី");
      setAddressFull("ផ្លូវ៧៦ ភូមិពូហ្យាម ឃុំ សែនមនោរម្យ ស្រុកអូរាំង ខេត្តមណ្ឌលគិរី");
      setBankName("eMoney");
      setBankAccountName("Pa Chamroun");
      setBankAccountNo("060363691");
      setEqPrinter(true);
      setEqScale(true);
      setEqBasket(false);
    } else {
      setBranchCode("PNPA");
      setContractDate("01/05/2026");
      setContractNo("PNPA010");
      setNameKh("ស៊ីម វិចិត្រ");
      setNameLatin("Sim Vichet");
      setIdNumber("110512075(01)");
      setPhone("0978850091");
      setEmail("skan1711@gmail.com");
      setHouseNo("12");
      setStreet("123");
      setVillage("ព្រៃឈើទាល");
      setCommune("អង្គរជ័យ");
      setDistrict("អង្គរជ័យ");
      setProvince("កំពត");
      setAddressFull("ផ្ទះលេខ12 ផ្លូវ 123 ភូមិ​ព្រៃឈើទាល ឃុំ​អង្គរជ័យ ស្រុក​អង្គរជ័យ ខេត្ត​កំពត");
      setBankName("eMoney");
      setBankAccountName("Sim Vichet");
      setBankAccountNo("855978850091");
      setEqPrinter(true);
      setEqScale(true);
      setEqBasket(false);
    }
  };

  const collectPayload = (): ContractFormPayload => {
    return {
      template_type: templateType,
      lang: contractLang,
      branch_code: branchCode,
      contract_no: contractNo,
      agent_code: contractNo,
      contract_date: contractDate,
      digit_style: digitStyle,
      agent_id: agentId,
      name_kh: nameKh,
      name_latin: nameLatin,
      id_number: idNumber,
      phone: phone,
      email: email,
      house_no: houseNo,
      street: street,
      village: village,
      commune: commune,
      district: district,
      province: province,
      address_full: addressFull,
      bank_name: bankName,
      bank_account_name: bankAccountName,
      bank_account_no: bankAccountNo,
      eq_printer: eqPrinter,
      eq_scale: eqScale,
      eq_basket: eqBasket,
      fixed_deposit: Number.isFinite(fixedDeposit) ? Math.max(0, fixedDeposit) : 0,
      company_name: companyName,
      company_law: companyLaw,
      company_reg_no: companyRegNo,
      company_reg_date: companyRegDate,
      company_tax_no: companyTaxNo,
      company_address: companyAddress,
    };
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const payload = collectPayload();
      const res = await fetch("/api/contracts/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showStatus(data.detail || "មានបញ្ហាក្នុងការមើលឡើងវិញ", true);
        return;
      }
      setPreviewData(data);
    } catch (err: any) {
      showStatus("កំហុស៖ " + err.message, true);
    } finally {
      setPreviewLoading(false);
    }
  };

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleGenerate = async (
    target: "both" | "docx_kh" | "docx_en" | "pdf_kh" | "pdf_en" | "docx" | "pdf" = "both"
  ) => {
    setGenerateLoading(true);
    try {
      const payload = collectPayload();
      const res = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showStatus(data.detail || "មិនអាចបង្កើតកិច្ចសន្យាបានទេ", true);
        return;
      }
      if (data.branches) setBranches(data.branches);
      if (data.agent) {
        setAgents((prev) => [data.agent, ...prev.filter((a) => a.id !== data.agent.id)]);
      }
      if (data.contract) {
        setRecentContracts((prev) => [data.contract, ...prev]);
      }
      showStatus(`បានបង្កើតកិច្ចសន្យាលេខ ${data.contract?.contract_no} និងរក្សាទុកភ្នាក់ងារ «${data.agent?.name_kh}» ដោយជោគជ័យ!`);

      // Trigger requested downloads
      if (target === "both") {
        if (data.docx_base64_kh) {
          triggerDownload(data.docx_base64_kh, data.docx_filename_kh || "contract_KH.docx");
        }
        setTimeout(() => {
          if (data.docx_base64_en) {
            triggerDownload(data.docx_base64_en, data.docx_filename_en || "contract_EN.docx");
          }
        }, 350);
      } else if (target === "docx_kh" || target === "docx") {
        const file = data.docx_base64_kh || data.docx_base64;
        const name = data.docx_filename_kh || data.docx_filename || "contract_KH.docx";
        if (file) triggerDownload(file, name);
      } else if (target === "docx_en") {
        const file = data.docx_base64_en;
        const name = data.docx_filename_en || "contract_EN.docx";
        if (file) triggerDownload(file, name);
      } else if (target === "pdf_kh" || target === "pdf") {
        const file = data.pdf_base64_kh || data.pdf_base64;
        const name = data.pdf_filename_kh || data.pdf_filename || "contract_KH.pdf";
        if (file) {
          triggerDownload(file, name);
        } else {
          showStatus("មិនអាចបង្កើតជា PDF បានទេ (PDF converter មិនទាន់ដំណើរការ)។ សូមទាញយកជា Word (.docx) ជំនួសវិញ។", true);
        }
      } else if (target === "pdf_en") {
        const file = data.pdf_base64_en;
        const name = data.pdf_filename_en || "contract_EN.pdf";
        if (file) {
          triggerDownload(file, name);
        } else {
          showStatus("មិនអាចបង្កើតជា PDF បានទេ (PDF converter មិនទាន់ដំណើរការ)។ សូមទាញយកជា Word (.docx) ជំនួសវិញ។", true);
        }
      }
    } catch (err: any) {
      showStatus("កំហុស៖ " + err.message, true);
    } finally {
      setGenerateLoading(false);
    }
  };

  // Live filter for old agents search
  const handleLiveSearch = (q: string) => {
    setAgentSearchQuery(q);
    const low = q.toLowerCase();
    const filtered = agents.filter(
      (ag) =>
        (ag.agent_code || "").toLowerCase().includes(low) ||
        (ag.name_kh || "").toLowerCase().includes(low) ||
        (ag.name_latin || "").toLowerCase().includes(low) ||
        (ag.phone || "").toLowerCase().includes(low) ||
        (ag.id_number || "").toLowerCase().includes(low)
    );
    setSearchedAgents(filtered);
  };

  // Save Branch Admin
  const handleSaveBranch = async () => {
    if (!bCode || !bProvKh || !bDirLatin) {
      showStatus("សូមបំពេញព័ត៌មានចាំបាច់សម្រាប់សាខា", true);
      return;
    }
    const res = await fetch("/api/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: bCode,
        province_kh: bProvKh,
        director_kh: bDirKh,
        director_latin: bDirLatin,
        body_name_format: bFormat,
        next_seq: bSeq,
      }),
    });
    if (res.ok) {
      const saved = await res.json();
      setBranches((prev) => [...prev.filter((b) => b.code !== saved.code), saved]);
      setBCode("");
      setBProvKh("");
      setBDirKh("");
      setBDirLatin("");
      showStatus("បានរក្សាទុកព័ត៌មានសាខាដោយជោគជ័យ!");
    } else {
      const err = await res.json();
      showStatus(err.detail || "កំហុសក្នុងការរក្សាទុកសាខា", true);
    }
  };

  // Save Agent Direct
  const handleSaveAgentDirect = async () => {
    if (!agNameKh || !agIdNo || !agPhone) {
      showStatus("សូមបំពេញឈ្មោះ អត្តសញ្ញាណប័ណ្ណ និងទូរស័ព្ទ", true);
      return;
    }
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: agEditId,
        branch_code: agBranch,
        agent_code: agCode,
        name_kh: agNameKh,
        name_latin: agNameLatin,
        id_number: agIdNo,
        phone: agPhone,
        bank_name: agBankName,
        bank_account_no: agBankNo,
        address_full: agAddr,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      setAgents(d.agents);
      setAgEditId(null);
      setAgCode("");
      setAgNameKh("");
      setAgNameLatin("");
      setAgIdNo("");
      setAgPhone("");
      setAgBankNo("");
      setAgAddr("");
      showStatus("បានរក្សាទុកភ្នាក់ងារដោយជោគជ័យ!");
    } else {
      const err = await res.json();
      showStatus(err.detail || "កំហុសក្នុងការរក្សាទុកភ្នាក់ងារ", true);
    }
  };

  const handleImportAgents = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/agents/import", { method: "POST", body: fd });
    if (res.ok) {
      const d = await res.json();
      setAgents(d.agents);
      showStatus(`បាននាំចូលភ្នាក់ងារចំនួន ${d.imported} នាក់ដោយជោគជ័យ!`);
    } else {
      showStatus("កំហុសក្នុងការនាំចូល", true);
    }
  };

  const handleSaveSettings = async () => {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      showStatus("បានរក្សាទុកការកំណត់ទម្រង់លេខដោយជោគជ័យ!");
    }
  };

  // Calculated equipment total
  const eqTotal =
    (Number.isFinite(fixedDeposit) ? Math.max(0, fixedDeposit) : 0) +
    (eqPrinter ? EQUIPMENT_PRICES.printer : 0) +
    (eqScale ? EQUIPMENT_PRICES.scale : 0) +
    (eqBasket ? EQUIPMENT_PRICES.basket : 0);

  // Current selected branch
  const currentBranch = branches.find((b) => b.code === branchCode);

  // Popup agent filter
  const activeBranch = branchCode.toUpperCase();
  const popupAgents = showAllPopupBranches
    ? agents
    : agents.filter((ag) => agentBranchCode(ag, branches) === activeBranch);
  const filteredPopupAgents = popupAgents.filter(
    (ag) =>
      (ag.agent_code || "").toLowerCase().includes(popupFilter.toLowerCase()) ||
      (ag.name_kh || "").toLowerCase().includes(popupFilter.toLowerCase()) ||
      (ag.name_latin || "").toLowerCase().includes(popupFilter.toLowerCase()) ||
      (ag.phone || "").toLowerCase().includes(popupFilter.toLowerCase())
  );

  return (
    <>
      <header>
        <div className="header-inner">
          <div>
            <h1 className="brand-title">ប្រព័ន្ធបំពេញកិច្ចសន្យាភ្នាក់ងារ មិត្តហ្វូន អ៊ិចប្រេស</h1>
            <div className="brand-sub">
              Metfone Express Agent Contract Filler
            </div>
          </div>
          <div className="nav-tabs">
            <button
              className={`nav-btn ${activeTab === "home" ? "active" : ""}`}
              onClick={() => setActiveTab("home")}
            >
              ទំព័រដើម
            </button>
            <button
              className={`nav-btn ${activeTab === "branches" ? "active" : ""}`}
              onClick={() => setActiveTab("branches")}
            >
              សាខា (Branches)
            </button>
            <button
              className={`nav-btn ${activeTab === "agents" ? "active" : ""}`}
              onClick={() => setActiveTab("agents")}
            >
              ទិន្នន័យភ្នាក់ងារ
            </button>
            <button
              className={`nav-btn ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              ប្រវត្តិកិច្ចសន្យា
            </button>
            <button
              className={`nav-btn ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              ការកំណត់ &amp; Tags
            </button>
          </div>
        </div>
      </header>

      <div className="container">
        {statusMsg && (
          <div className={`alert ${statusMsg.isError ? "alert-error" : "alert-success"}`}>
            {statusMsg.text}
          </div>
        )}

        {/* 1. HOME SCREEN */}
        {activeTab === "home" && (
          <div className="card home-hero">
            <h2>សូមជ្រើសរើសប្រភេទកិច្ចសន្យាភ្នាក់ងារ</h2>
            <p style={{ color: "var(--muted)", maxWidth: 640, margin: "0 auto" }}>
              បង្កើតកិច្ចសន្យាភ្នាក់ងារថ្មី ឬ ស្វែងរកទិន្នន័យភ្នាក់ងារចាស់ដើម្បីបោះពុម្ភកិច្ចសន្យាឡើងវិញ ជាទម្រង់ Word (.docx) និង PDF ដោយស្វ័យប្រវត្តិ។
            </p>
            <div className="home-actions">
              <button className="big-flow-btn" onClick={() => openContractFlow("NEW")}>
                <div className="kh-label">បង្កើតកិច្ចសន្យាភ្នាក់ងារថ្មី</div>
                <div className="en-label">New Agent Contract</div>
              </button>

              <button className="big-flow-btn old-flow" onClick={() => openContractFlow("OLD")}>
                <div className="kh-label">បោះពុម្ភកិច្ចសន្យាភ្នាក់ងារចាស់</div>
                <div className="en-label">Old Agent Contract</div>
              </button>
            </div>
          </div>
        )}

        {/* 2. CONTRACT FORM */}
        {activeTab === "form" && (
          <div>
            {templateType === "OLD" && (
              <div className="card" style={{ borderLeft: "5px solid #E2424A", marginBottom: 20 }}>
                <div className="section-title">
                  <span>ស្វែងរកទិន្នន័យភ្នាក់ងារចាស់ (Search Existing Agent Database)</span>
                  <span className="badge badge-old">Flow B — ទម្រង់ចាស់ (old_km.docx)</span>
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <input
                    type="text"
                    value={agentSearchQuery}
                    placeholder="វាយបញ្ចូល កូដភ្នាក់ងារ (Agent Code), ឈ្មោះខ្មែរ, ឈ្មោះឡាតាំង, លេខទូរស័ព្ទ..."
                    onChange={(e) => handleLiveSearch(e.target.value)}
                  />
                </div>
                <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>កូដភ្នាក់ងារ</th>
                        <th>ឈ្មោះខ្មែរ</th>
                        <th>ឈ្មោះឡាតាំង</th>
                        <th>អត្តសញ្ញាណប័ណ្ណ</th>
                        <th>ទូរស័ព្ទ</th>
                        <th>ខេត្ត/អាសយដ្ឋាន</th>
                        <th>សកម្មភាព</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedAgents.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)" }}>
                            រកមិនឃើញភ្នាក់ងារទេ
                          </td>
                        </tr>
                      ) : (
                        searchedAgents.map((ag) => (
                          <tr key={ag.id}>
                            <td>
                              <span className="badge badge-old">{ag.agent_code || "-"}</span>
                            </td>
                            <td>
                              <strong>{ag.name_kh}</strong>
                            </td>
                            <td>{ag.name_latin}</td>
                            <td>{ag.id_number}</td>
                            <td>{ag.phone}</td>
                            <td>{ag.address_full}</td>
                            <td>
                              <button
                                className="btn btn-docx btn-sm"
                                onClick={() => fillFormFromAgent(ag, true)}
                              >
                                ជ្រើសរើស
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Header matching Image 1: Agent Contract Generator មុខងារបង្កើតកិច្ចសន្យាជាមួយភ្នាក់ងារ */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#1e293b", letterSpacing: "-0.02em" }}>
                Agent Contract Generator
              </h2>
              <span style={{ fontSize: 16, color: "#64748b", fontWeight: 500 }}>
                មុខងារបង្កើតកិច្ចសន្យាជាមួយភ្នាក់ងារ
              </span>
            </div>

            {/* Section 1: Contract */}
            <div className="mini-card">
              <div className="mini-card-title">Contract</div>
              <div className="mini-card-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label>Contract number</label>
                    <input
                      type="text"
                      value={contractNo}
                      onChange={(e) => onContractNoChange(e.target.value)}
                      placeholder="ឧ. PURA019"
                    />
                  </div>
                  <div className="form-group">
                    <label>Signing / effective date</label>
                    <input
                      type="text"
                      value={contractDate}
                      onChange={(e) => setContractDate(e.target.value)}
                      placeholder="DD/MM/YYYY ឬ YYYY-MM-DD"
                    />
                  </div>
                </div>
                <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: "0.85rem", color: "#64748b" }}>
                  <div>
                    <strong>Branch:</strong> {currentBranch ? (KHMER_TO_ENGLISH_PROVINCE[currentBranch.province_kh] || currentBranch.code) : branchCode} / {currentBranch?.province_kh || ""} — <strong>Director:</strong> {currentBranch ? directorBodyName(currentBranch) : "-"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>ជ្រើសរើសសាខា៖</span>
                    <select
                      value={branchCode}
                      onChange={(e) => onBranchChange(e.target.value)}
                      style={{ padding: "4px 8px", fontSize: "0.82rem", width: "auto" }}
                    >
                      {branches.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.code} — {b.province_kh}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: ព័ត៌មានសម្គាល់ភ្នាក់ងារ (ភាគី ខ) */}
            <div className="mini-card">
              <div className="mini-card-title">ព័ត៌មានសម្គាល់ភ្នាក់ងារ (ភាគី ខ)</div>
              <div className="mini-card-body">
                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr", gap: 14 }}>
                  <div className="form-group">
                    <label>ងារ</label>
                    <select value={agentTitle} onChange={(e) => setAgentTitle(e.target.value)}>
                      <option value="លោក">លោក</option>
                      <option value="លោកស្រី">លោកស្រី</option>
                      <option value="អ្នកនាង">អ្នកនាង</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>ឈ្មោះជាអក្សរខ្មែរ <span className="req">*</span></label>
                    <input
                      type="text"
                      value={nameKh}
                      placeholder="ឧ. ប៉ា ចំរើន"
                      onChange={(e) => onKhmerNameChange(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>ឈ្មោះជាអក្សរឡាតាំង <span className="req">*</span></label>
                    <input
                      type="text"
                      value={nameLatin}
                      placeholder="ឧ. Pa Chamroun"
                      onChange={(e) => {
                        latinManuallyEdited.current = true;
                        setNameLatin(e.target.value);
                      }}
                    />
                  </div>
                </div>
                <div className="grid-2" style={{ marginTop: 14 }}>
                  <div className="form-group">
                    <label>លេខអត្តសញ្ញាណប័ណ្ណ <span className="req">*</span></label>
                    <input
                      type="text"
                      value={idNumber}
                      placeholder="ឧ. 230067812"
                      onChange={(e) => setIdNumber(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>លេខទូរស័ព្ទ <span className="req">*</span></label>
                    <input
                      type="text"
                      value={phone}
                      placeholder="ឧ. 060363691"
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: អាសយដ្ឋានទីលំនៅ */}
            <div className="mini-card">
              <div className="mini-card-title">អាសយដ្ឋានទីលំនៅ</div>
              <div className="mini-card-body">
                <div className="grid-3">
                  <div className="form-group">
                    <label>Province</label>
                    <select
                      value={matchedProvince}
                      onChange={(e) => handleProvinceSelect(e.target.value)}
                    >
                      <option value="">-- ជ្រើសរើស Province --</option>
                      {PROVINCES_LIST.map((p) => {
                        const enName = gazetteerData[p]?.en || p;
                        return (
                          <option key={p} value={p}>
                            {p} ({enName})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>District / Khan / Krong</label>
                    <select
                      value={matchedDistrict}
                      disabled={!matchedProvince}
                      onChange={(e) => handleDistrictSelect(e.target.value)}
                    >
                      <option value="">
                        {matchedProvince ? "-- ជ្រើសរើស District --" : "-- សូមជ្រើសរើសខេត្តជាមុន --"}
                      </option>
                      {availableDistricts.map((d) => {
                        const distEn = gazetteerData[matchedProvince]?.districts?.[d]?.en || d;
                        return (
                          <option key={d} value={d}>
                            {d} ({distEn})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Commune / Sangkat</label>
                    <select
                      value={matchedCommune}
                      disabled={!matchedDistrict}
                      onChange={(e) => handleCommuneSelect(e.target.value)}
                    >
                      <option value="">
                        {matchedDistrict ? "-- ជ្រើសរើស Commune --" : "-- សូមជ្រើសរើសស្រុកជាមុន --"}
                      </option>
                      {availableCommunes.map((c) => {
                        const comEn = gazetteerData[matchedProvince]?.districts?.[matchedDistrict]?.communes?.[c]?.en || c;
                        return (
                          <option key={c} value={c}>
                            {c} ({comEn})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="grid-3" style={{ marginTop: 14 }}>
                  <div className="form-group">
                    <label>Village</label>
                    <select
                      value={matchedVillage}
                      disabled={!matchedCommune}
                      onChange={(e) => handleVillageSelect(e.target.value)}
                    >
                      <option value="">
                        {matchedCommune ? "-- ជ្រើសរើស Village --" : "-- សូមជ្រើសរើសឃុំជាមុន --"}
                      </option>
                      {availableVillages.map((v) => (
                        <option key={v.val} value={v.val}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>House number (optional)</label>
                    <input
                      type="text"
                      value={houseNo}
                      placeholder="ឧ. 12"
                      onChange={(e) => handleAddressPartChange("houseNo", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Street (optional)</label>
                    <input
                      type="text"
                      value={street}
                      placeholder="ឧ. ៧៦"
                      onChange={(e) => handleAddressPartChange("street", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: អាសយដ្ឋានទីតាំងភ្នាក់ងារ */}
            <div className="mini-card">
              <div className="mini-card-title">អាសយដ្ឋានទីតាំងភ្នាក់ងារ</div>
              <div className="mini-card-body">
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    checked={locationMatchesResidence}
                    onChange={(e) => {
                      setLocationMatchesResidence(e.target.checked);
                      if (e.target.checked) {
                        addressManuallyEdited.current = false;
                        syncAddressFull();
                      }
                    }}
                    style={{ width: 17, height: 17, cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.92rem", fontWeight: 500, color: "#1e293b" }}>
                    អាសយដ្ឋានទីតាំងភ្នាក់ងារ គឺជាអាសយដ្ឋានទីលំនៅផ្ទាល់
                  </span>
                </label>
                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ margin: 0 }}>
                      អាសយដ្ឋានពេញលេញក្នុងកិច្ចសន្យា (អាចកែសម្រួលផ្ទាល់បាន) <span className="req">*</span>
                    </label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: "3px 10px", fontSize: "0.8rem", cursor: "pointer" }}
                      onClick={() => syncAddressFull()}
                      title="បំពេញអាសយដ្ឋានពេញលេញឡើងវិញពីប្រអប់ទាំង ៦ ខាងលើ"
                    >
                      បំពេញស្វ័យប្រវត្តិ (Auto-fill)
                    </button>
                  </div>
                  <input
                    type="text"
                    value={addressFull}
                    placeholder="ផ្លូវ... ភូមិ... ឃុំ... ស្រុក... ខេត្ត..."
                    onChange={(e) => {
                      addressManuallyEdited.current = true;
                      setAddressFull(e.target.value);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Bank */}
            <div className="mini-card">
              <div className="mini-card-title">Bank</div>
              <div className="mini-card-body">
                <div className="grid-3">
                  <div className="form-group">
                    <label>ព័ត៌មានធនាគារ (គប្បីប្រើ eMoney)</label>
                    <input
                      type="text"
                      value={bankName}
                      placeholder="eMoney / អ៊ីម៉ាន់នី"
                      onChange={(e) => setBankName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>លេខកុង</label>
                    <input
                      type="text"
                      value={bankAccountNo}
                      placeholder="ឧ. 0889158332"
                      onChange={(e) => setBankAccountNo(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>ឈ្មោះម្ចាស់កុង</label>
                    <input
                      type="text"
                      value={bankAccountName}
                      placeholder="ឧ. Pa Chamroun"
                      onChange={(e) => {
                        bankAccountManuallyEdited.current = true;
                        setBankAccountName(e.target.value);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 6 (Optional): Company Information for Old Template */}
            {templateType === "OLD" && (
              <div className="mini-card">
                <div className="mini-card-title">ព័ត៌មានក្រុមហ៊ុន (Company Information - ភាគី ខ)</div>
                <div className="mini-card-body">
                  <div className="grid-3">
                    <div className="form-group">
                      <label>ឈ្មោះក្រុមហ៊ុន</label>
                      <input
                        type="text"
                        value={companyName}
                        placeholder="ទុកទទេ = ........................"
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>បង្កើតក្រោមច្បាប់នៃ</label>
                      <input
                        type="text"
                        value={companyLaw}
                        placeholder="ទុកទទេ = ........................"
                        onChange={(e) => setCompanyLaw(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>លេខចុះបញ្ជីពាណិជ្ជកម្ម</label>
                      <input
                        type="text"
                        value={companyRegNo}
                        placeholder="ទុកទទេ = ........................"
                        onChange={(e) => setCompanyRegNo(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>ចុះថ្ងៃទី (ក្រសួងពាណិជ្ជកម្ម)</label>
                      <input
                        type="text"
                        value={companyRegDate}
                        placeholder="ទុកទទេ = ........................"
                        onChange={(e) => setCompanyRegDate(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>លេខពន្ធដារ</label>
                      <input
                        type="text"
                        value={companyTaxNo}
                        placeholder="ទុកទទេ = ........................"
                        onChange={(e) => setCompanyTaxNo(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>អាសយដ្ឋានចុះបញ្ជីក្រុមហ៊ុន</label>
                      <input
                        type="text"
                        value={companyAddress}
                        placeholder="ទុកទទេ = ........................"
                        onChange={(e) => setCompanyAddress(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 7: សម្ភារៈផ្តល់ និងប្រាក់កក់ */}
            <div className="mini-card">
              <div className="mini-card-title">សម្ភារៈផ្តល់ និងប្រាក់កក់</div>
              <div className="mini-card-body">
                <div
                  className="eq-box"
                  style={{
                    background: "#f8fafc",
                    border: "1px solid var(--border)",
                    cursor: "default",
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>
                      ប្រាក់កក់ថេរសម្រាប់ការធានា (ប្រការ ៣.៧)
                    </div>
                    <div className="hint" style={{ marginTop: 2 }}>
                      លំនាំដើម USD 50 ($50) — អាចកែសម្រួលចំនួនទឹកប្រាក់បាន និងបូកបញ្ចូលក្នុងសរុប
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 700, color: "#475569" }}>$</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={fixedDeposit}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setFixedDeposit(Number.isNaN(val) ? 0 : Math.max(0, val));
                      }}
                      style={{
                        width: 96,
                        textAlign: "right",
                        fontWeight: 700,
                        padding: "6px 10px",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label className={`eq-box ${eqPrinter ? "checked" : ""}`}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input
                        type="checkbox"
                        checked={eqPrinter}
                        disabled={templateType === "OLD"}
                        onChange={(e) => setEqPrinter(e.target.checked)}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          Xprinter XP-DT427B thermal printer (WiFi)
                        </div>
                      </div>
                    </div>
                    <span className="price-badge">$150</span>
                  </label>

                  <label className={`eq-box ${eqScale ? "checked" : ""}`}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input
                        type="checkbox"
                        checked={eqScale}
                        onChange={(e) => setEqScale(e.target.checked)}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          30 kg mechanical scale
                        </div>
                      </div>
                    </div>
                    <span className="price-badge">$65</span>
                  </label>

                  <label className={`eq-box ${eqBasket ? "checked" : ""}`}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input
                        type="checkbox"
                        checked={eqBasket}
                        onChange={(e) => setEqBasket(e.target.checked)}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          Delivery plastic basket (780*500*430)
                        </div>
                      </div>
                    </div>
                    <span className="price-badge">$35</span>
                  </label>
                </div>

                {/* Total Bar */}
                <div className="total-bar" style={{ marginTop: 16 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      ចំនួនទឹកប្រាក់សរុប (US$)
                    </div>
                  </div>
                  <div className="amount">${eqTotal}</div>
                </div>

                {/* Action Buttons */}
                <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      padding: "13px 20px",
                      fontSize: "1rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                    }}
                    disabled={generateLoading}
                    onClick={() => handleGenerate("both")}
                  >
                    {generateLoading
                      ? "កំពុងបង្កើតកិច្ចសន្យា..."
                      : "ទាញយកកិច្ចសន្យាទាំង ២ (Download Both: KH & EN .docx)"}
                  </button>

                  <div className="btn-row" style={{ marginTop: 0 }}>
                    <button
                      type="button"
                      className="btn btn-docx"
                      disabled={generateLoading}
                      onClick={() => handleGenerate("docx_kh")}
                    >
                      ទាញយក Word ខ្មែរ (.docx)
                    </button>
                    <button
                      type="button"
                      className="btn btn-docx"
                      disabled={generateLoading}
                      onClick={() => handleGenerate("docx_en")}
                    >
                      Download English Word (.docx)
                    </button>
                    <button
                      type="button"
                      className="btn btn-preview"
                      disabled={previewLoading}
                      onClick={handlePreview}
                    >
                      {previewLoading ? "កំពុងរៀបចំ..." : "មើលឡើងវិញ (Preview)"}
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 4 }}>
                    <button
                      type="button"
                      className="btn btn-pdf btn-sm"
                      disabled={generateLoading}
                      onClick={() => handleGenerate("pdf_kh")}
                    >
                      បោះពុម្ភជា PDF ខ្មែរ
                    </button>
                    <button
                      type="button"
                      className="btn btn-pdf btn-sm"
                      disabled={generateLoading}
                      onClick={() => handleGenerate("pdf_en")}
                    >
                      Export English PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Output Panel */}
            {previewData && (
              <div className="card" style={{ marginTop: 20 }}>
                <div className="section-title">
                  <span>មើលឡើងវិញនូវកិច្ចសន្យាដែលបានបំពេញ (Preview)</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        background: previewTab === "kh" ? "#E2424A" : "#FFFFFF",
                        color: previewTab === "kh" ? "#FFFFFF" : "#E2424A",
                        border: "1px solid #E2424A",
                        fontWeight: 600,
                      }}
                      onClick={() => setPreviewTab("kh")}
                    >
                      ទម្រង់ខ្មែរ (Khmer)
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        background: previewTab === "en" ? "#E2424A" : "#FFFFFF",
                        color: previewTab === "en" ? "#FFFFFF" : "#E2424A",
                        border: "1px solid #E2424A",
                        fontWeight: 600,
                      }}
                      onClick={() => setPreviewTab("en")}
                    >
                      English Version
                    </button>
                    {previewData.preview_docx_base64_kh && (
                      <a
                        href={previewData.preview_docx_base64_kh}
                        download={`PREVIEW_${contractNo}_KH.docx`}
                        className="btn btn-docx btn-sm"
                      >
                        Word ខ្មែរ (.docx)
                      </a>
                    )}
                    {previewData.preview_docx_base64_en && (
                      <a
                        href={previewData.preview_docx_base64_en}
                        download={`PREVIEW_${contractNo}_EN.docx`}
                        className="btn btn-docx btn-sm"
                      >
                        Word EN (.docx)
                      </a>
                    )}
                  </div>
                </div>
                {(() => {
                  const ctx = previewTab === "en" ? (previewData.context_en || previewData.context) : (previewData.context_kh || previewData.context);
                  const isEn = previewTab === "en";
                  return (
                    <div
                      style={{
                        background: "#F3E8D2",
                        border: "1px solid #e5d8be",
                        borderRadius: 8,
                        padding: 16,
                        fontSize: "0.92rem",
                      }}
                    >
                      <div className="grid-2">
                        <div>
                          <strong>{isEn ? "Contract No.:" : "លេខកិច្ចសន្យា៖"}</strong> {ctx.contract_no}
                          <br />
                          <strong>{isEn ? "Effective Date:" : "កាលបរិច្ឆេទ៖"}</strong>{" "}
                          {isEn
                            ? `${ctx.day}/${ctx.month}/${ctx.year}`
                            : `ថ្ងៃទី ${ctx.day} ខែ ${ctx.month} ឆ្នាំ ${ctx.year}`}
                          <br />
                          <strong>{isEn ? "Party A (Branch):" : "ភាគី ក (ក្នុងតួកិច្ចសន្យា)៖"}</strong>{" "}
                          {isEn
                            ? `Represented by ${ctx.director_latin}, Branch Director of ${ctx.branch_province_en}`
                            : `តំណាងដោយលោក ${ctx.director_body_name} នាយកសាខា ${ctx.branch_province_kh}`}
                          <br />
                          <strong>{isEn ? "Party A Signature:" : "ហត្ថលេខាភាគី ក (២ កន្លែង)៖"}</strong> {ctx.director_latin}
                          <br />
                          <strong>{isEn ? "Deposit Total (Annex 1):" : "ប្រាក់កក់ឧបករណ៍សរុប (ឧបសម្ព័ន្ធ ០១)៖"}</strong>{" "}
                          <span style={{ fontWeight: 700, color: "#E2424A" }}>{ctx.eq_deposit_sum}</span>
                        </div>
                        <div>
                          <strong>{isEn ? "Party B Name:" : "ភាគី ខ (ឈ្មោះ)៖"}</strong>{" "}
                          {isEn ? ctx.agent_name_latin || ctx.agent_name_kh : `${ctx.agent_name_kh} (${ctx.agent_name_latin})`}
                          <br />
                          <strong>{isEn ? "ID / Phone:" : "អត្តសញ្ញាណប័ណ្ណ / ទូរស័ព្ទ៖"}</strong> {ctx.id_number} / {ctx.phone}
                          <br />
                          <strong>{isEn ? "Address:" : "អាសយដ្ឋាន (ទាំង ២ កន្លែង)៖"}</strong> {ctx.address}
                          <br />
                          <strong>{isEn ? "Bank Account:" : "គណនីធនាគារ៖"}</strong> {ctx.bank_account_name} — {ctx.bank_account_no} ({ctx.bank_name})
                          <br />
                          <strong>{isEn ? "Equipment:" : "ឧបករណ៍ឧបសម្ព័ន្ធ ០១៖"}</strong>{" "}
                          {isEn ? "Printer" : "ម៉ាស៊ីនព្រីន"} [{ctx.eq_printer}] | {isEn ? "Scale" : "ជញ្ជីង"} [{ctx.eq_scale}] | {isEn ? "Basket" : "កញ្ច្រែង"} [{ctx.eq_basket}]
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* 3. BRANCHES ADMIN VIEW */}
        {activeTab === "branches" && (
          <div className="card">
            <div className="section-title">
              <span>គ្រប់គ្រងតារាងសាខា (Branches Table — Admin)</span>
              <span className="hint">រក្សាទុកក្នុង Supabase ដោយស្វ័យប្រវត្តិ</span>
            </div>
            <div
              className="grid-3"
              style={{
                background: "#f8fafc",
                padding: 16,
                borderRadius: 10,
                border: "1px solid var(--border)",
                marginBottom: 20,
              }}
            >
              <div className="form-group">
                <label>
                  កូដសាខា (Code) <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={bCode}
                  placeholder="ឧ. MONA, PNPA"
                  onChange={(e) => setBCode(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>
                  ខេត្ត/រាជធានី (Province in Khmer) <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={bProvKh}
                  placeholder="ឧ. មណ្ឌលគិរី"
                  onChange={(e) => setBProvKh(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>ឈ្មោះនាយកសាខា (អក្សរខ្មែរ)</label>
                <input
                  type="text"
                  value={bDirKh}
                  placeholder="ឧ. លាង រដ្ឋា"
                  onChange={(e) => setBDirKh(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>
                  ឈ្មោះនាយកសាខា (អក្សរឡាតាំង) <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={bDirLatin}
                  placeholder="ឧ. Leang Ratha"
                  onChange={(e) => setBDirLatin(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>ទម្រង់ឈ្មោះក្នុងតួកិច្ចសន្យា</label>
                <select value={bFormat} onChange={(e) => setBFormat(e.target.value as any)}>
                  <option value="khmer">khmer (បង្ហាញឈ្មោះខ្មែរក្នុងតួកិច្ចសន្យា)</option>
                  <option value="latin">latin (បង្ហាញឈ្មោះឡាតាំងក្នុងតួកិច្ចសន្យា)</option>
                </select>
              </div>
              <div className="form-group">
                <label>លេខរៀងកិច្ចសន្យាបន្ទាប់ (next_seq)</label>
                <input
                  type="number"
                  value={bSeq}
                  min={1}
                  onChange={(e) => setBSeq(parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}>
                <button className="btn btn-preview btn-sm" onClick={handleSaveBranch}>
                  រក្សាទុកសាខា (Save / Update Branch)
                </button>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>កូដ (code)</th>
                  <th>ខេត្ត/រាជធានី (province_kh)</th>
                  <th>នាយកសាខាខ្មែរ</th>
                  <th>នាយកសាខាឡាតាំង</th>
                  <th>body_name_format</th>
                  <th>លេខកិច្ចសន្យាបន្ទាប់</th>
                  <th>សកម្មភាព</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.code}>
                    <td>
                      <strong>{b.code}</strong>
                    </td>
                    <td>{b.province_kh}</td>
                    <td>{b.director_kh || "(ទទេ)"}</td>
                    <td>{b.director_latin}</td>
                    <td>
                      <span className={`badge ${b.body_name_format === "khmer" ? "badge-new" : "badge-old"}`}>
                        {b.body_name_format}
                      </span>
                    </td>
                    <td>
                      <code>{b.next_contract_no}</code> (seq: {b.next_seq})
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setBCode(b.code);
                          setBProvKh(b.province_kh);
                          setBDirKh(b.director_kh || "");
                          setBDirLatin(b.director_latin);
                          setBFormat(b.body_name_format);
                          setBSeq(b.next_seq);
                        }}
                      >
                        កែប្រែ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. AGENTS DATABASE VIEW */}
        {activeTab === "agents" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Agents Database
                </h2>
                <span style={{ fontSize: 15, color: "#64748b", fontWeight: 500 }}>
                  ទិន្នន័យភ្នាក់ងារ និង ការនាំចូល
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
                  នាំចូល Excel / CSV
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    style={{ display: "none" }}
                    onChange={handleImportAgents}
                  />
                </label>
                <a href="/api/agents/export" className="btn btn-secondary btn-sm">
                  នាំចេញ CSV
                </a>
              </div>
            </div>

            {/* Direct Add/Edit Agent Card */}
            <div className="mini-card">
              <div className="mini-card-title">
                <span>{agEditId ? `កែប្រែព័ត៌មានភ្នាក់ងារ (ID: ${agEditId})` : "បន្ថែមភ្នាក់ងារថ្មី (Add Agent)"}</span>
              </div>
              <div className="grid-4">
                <div className="form-group">
                  <label>
                    សាខា (Branch) <span className="req">*</span>
                  </label>
                  <select value={agBranch} onChange={(e) => setAgBranch(e.target.value)}>
                    {branches.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.code} — {b.province_kh}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>
                    កូដភ្នាក់ងារ (Agent Code) <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    value={agCode}
                    placeholder="ឧ. MONA011"
                    onChange={(e) => setAgCode(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>
                    ឈ្មោះខ្មែរ <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    value={agNameKh}
                    placeholder="ឧ. ប៉ា ចំរើន"
                    onChange={(e) => setAgNameKh(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>ឈ្មោះឡាតាំង</label>
                  <input
                    type="text"
                    value={agNameLatin}
                    placeholder="ឧ. Pa Chamroun"
                    onChange={(e) => setAgNameLatin(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>
                    អត្តសញ្ញាណប័ណ្ណ <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    value={agIdNo}
                    placeholder="ឧ. 230067812"
                    onChange={(e) => setAgIdNo(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>
                    ទូរស័ព្ទ <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    value={agPhone}
                    placeholder="ឧ. 060363691"
                    onChange={(e) => setAgPhone(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>ធនាគារ</label>
                  <input
                    type="text"
                    value={agBankName}
                    onChange={(e) => setAgBankName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>លេខគណនីធនាគារ</label>
                  <input
                    type="text"
                    value={agBankNo}
                    placeholder="ឧ. 060363691"
                    onChange={(e) => setAgBankNo(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label>អាសយដ្ឋានពេញលេញ</label>
                  <input
                    type="text"
                    value={agAddr}
                    placeholder="ផ្លូវ... ភូមិ... ឃុំ... ស្រុក... ខេត្ត..."
                    onChange={(e) => setAgAddr(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                <button className="btn btn-primary btn-sm" onClick={handleSaveAgentDirect}>
                  {agEditId ? "រក្សាទុកការកែប្រែ (Update Agent)" : "រក្សាទុកភ្នាក់ងារ (Save Agent)"}
                </button>
                {agEditId && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setAgEditId(null);
                      setAgCode("");
                      setAgNameKh("");
                      setAgNameLatin("");
                      setAgIdNo("");
                      setAgPhone("");
                      setAgBankName("eMoney");
                      setAgBankNo("");
                      setAgAddr("");
                    }}
                  >
                    បោះបង់ (Cancel)
                  </button>
                )}
              </div>
            </div>

            {/* Search & Table Card */}
            <div className="mini-card">
              <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <input
                    type="text"
                    value={dbAgentSearch}
                    placeholder="ស្វែងរកតាម កូដភ្នាក់ងារ, ឈ្មោះខ្មែរ, ឈ្មោះឡាតាំង, លេខទូរស័ព្ទ..."
                    onChange={(e) => setDbAgentSearch(e.target.value)}
                  />
                </div>
                <span className="badge badge-new">សរុប៖ {agents.length} នាក់</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>សាខា</th>
                      <th>កូដភ្នាក់ងារ</th>
                      <th>ឈ្មោះខ្មែរ</th>
                      <th>ឈ្មោះឡាតាំង</th>
                      <th>អត្តសញ្ញាណប័ណ្ណ</th>
                      <th>ទូរស័ព្ទ</th>
                      <th>គណនីធនាគារ</th>
                      <th style={{ minWidth: 240 }}>អាសយដ្ឋាន</th>
                      <th>សកម្មភាព</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents
                      .filter(
                        (ag) =>
                          !dbAgentSearch ||
                          (ag.name_kh || "").toLowerCase().includes(dbAgentSearch.toLowerCase()) ||
                          (ag.name_latin || "").toLowerCase().includes(dbAgentSearch.toLowerCase()) ||
                          (ag.agent_code || "").toLowerCase().includes(dbAgentSearch.toLowerCase()) ||
                          (ag.phone || "").includes(dbAgentSearch)
                      )
                      .map((ag) => (
                        <tr key={ag.id}>
                          <td className="nowrap" style={{ color: "var(--muted)" }}>{ag.id}</td>
                          <td className="nowrap">
                            <span className="badge badge-new">{agentBranchCode(ag, branches)}</span>
                          </td>
                          <td className="nowrap">
                            <span className="badge badge-old">{ag.agent_code || "-"}</span>
                          </td>
                          <td className="nowrap">
                            <strong>{ag.name_kh}</strong>
                          </td>
                          <td style={{ minWidth: 130 }}>{ag.name_latin}</td>
                          <td className="nowrap">{ag.id_number}</td>
                          <td className="nowrap">{ag.phone}</td>
                          <td style={{ minWidth: 180 }}>
                            {ag.bank_name}: {ag.bank_account_no} ({ag.bank_account_name})
                          </td>
                          <td style={{ minWidth: 240, lineHeight: 1.45, color: "var(--text-secondary)" }}>
                            {ag.address_full}
                          </td>
                          <td className="nowrap">
                            <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setAgEditId(ag.id);
                                  setAgBranch(agentBranchCode(ag, branches));
                                  setAgCode(ag.agent_code || "");
                                  setAgNameKh(ag.name_kh || "");
                                  setAgNameLatin(ag.name_latin || "");
                                  setAgIdNo(ag.id_number || "");
                                  setAgPhone(ag.phone || "");
                                  setAgBankName(ag.bank_name || "eMoney");
                                  setAgBankNo(ag.bank_account_no || "");
                                  setAgAddr(ag.address_full || "");
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                              >
                                កែប្រែ
                              </button>
                              <button
                                className="btn btn-docx btn-sm"
                                onClick={() => {
                                  openContractFlow("OLD");
                                  fillFormFromAgent(ag, true);
                                }}
                              >
                                បោះពុម្ពទម្រង់ចាស់
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 5. HISTORY VIEW */}
        {activeTab === "history" && (
          <div className="card">
            <div className="section-title">
              <span>ប្រវត្តិកិច្ចសន្យាដែលបានបង្កើត (Contracts History)</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>លេខកិច្ចសន្យា</th>
                  <th>កាលបរិច្ឆេទ</th>
                  <th>សាខា</th>
                  <th>ភ្នាក់ងារ (ភាគី ខ)</th>
                  <th>ទម្រង់</th>
                  <th>ប្រាក់កក់ឧបករណ៍</th>
                  <th>ឯកសារ</th>
                </tr>
              </thead>
              <tbody>
                {recentContracts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)" }}>
                      មិនទាន់មានប្រវត្តិកិច្ចសន្យាទេ
                    </td>
                  </tr>
                ) : (
                  recentContracts.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.contract_no}</strong>
                      </td>
                      <td>{c.contract_date}</td>
                      <td>{c.branch_code}</td>
                      <td>
                        {c.agent_name_kh} ({c.agent_name_latin})
                      </td>
                      <td>
                        <span className={`badge ${c.template_type === "NEW" ? "badge-new" : "badge-old"}`}>
                          {c.template_type}
                        </span>
                      </td>
                      <td>${c.eq_deposit_total}</td>
                      <td>
                        {c.docx_path && (
                          <span style={{ fontSize: "0.85rem", color: "#64748b" }}>{c.docx_path}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. SETTINGS VIEW */}
        {activeTab === "settings" && (
          <div className="card">
            <div className="section-title">
              <span>ការកំណត់ទម្រង់លេខ និង បញ្ជី Tags ក្នុងគំរូ Word (.docx)</span>
            </div>
            <div
              className="grid-2"
              style={{
                background: "#f8fafc",
                padding: 16,
                borderRadius: 10,
                border: "1px solid var(--border)",
                marginBottom: 24,
              }}
            >
              <div className="form-group">
                <label>ទម្រង់លេខលំនាំដើមសម្រាប់កិច្ចសន្យាភ្នាក់ងារថ្មី (NEW Template)</label>
                <select
                  value={settings.new_digit_style}
                  onChange={(e) =>
                    setSettings({ ...settings, new_digit_style: e.target.value as any })
                  }
                >
                  <option value="khmer">លេខខ្មែរ (០១២៣៤៥៦៧៨៩)</option>
                  <option value="latin">លេខឡាតាំង (0123456789)</option>
                </select>
              </div>
              <div className="form-group">
                <label>ទម្រង់លេខលំនាំដើមសម្រាប់កិច្ចសន្យាភ្នាក់ងារចាស់ (OLD Template)</label>
                <select
                  value={settings.old_digit_style}
                  onChange={(e) =>
                    setSettings({ ...settings, old_digit_style: e.target.value as any })
                  }
                >
                  <option value="latin">លេខឡាតាំង (0123456789)</option>
                  <option value="khmer">លេខខ្មែរ (០១២៣៤៥៦៧៨៩)</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <button className="btn btn-preview btn-sm" onClick={handleSaveSettings}>
                  រក្សាទុកការកំណត់ (Save Settings)
                </button>
              </div>
            </div>

            <h3 className="section-title">
              បញ្ជី Tags ក្នុងគំរូទី ១៖ new_agreement_template.docx (ភ្នាក់ងារថ្មី)
            </h3>
            <table>
              <thead>
                <tr>
                  <th>ទីតាំងក្នុងឯកសារ</th>
                  <th>Tag</th>
                  <th>អត្ថបទគំរូដើមដែលត្រូវបានជំនួស</th>
                  <th>ការពិពណ៌នា</th>
                </tr>
              </thead>
              <tbody>
                {initialData.tag_reference?.new_template?.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.location}</td>
                    <td>
                      <code>{item.tag}</code>
                    </td>
                    <td>{item.original_text}</td>
                    <td>{item.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="section-title" style={{ marginTop: 28 }}>
              បញ្ជី Tags ក្នុងគំរូទី ២៖ old_agreement_template.docx (ភ្នាក់ងារចាស់)
            </h3>
            <table>
              <thead>
                <tr>
                  <th>ទីតាំងក្នុងឯកសារ</th>
                  <th>Tag</th>
                  <th>អត្ថបទគំរូដើមដែលត្រូវបានជំនួស</th>
                  <th>ការពិពណ៌នា</th>
                </tr>
              </thead>
              <tbody>
                {initialData.tag_reference?.old_template?.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.location}</td>
                    <td>
                      <code>{item.tag}</code>
                    </td>
                    <td>{item.original_text}</td>
                    <td>{item.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
