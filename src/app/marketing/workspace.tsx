"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Link2,
  Megaphone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  countries,
  currencies,
  moneyText,
  parseMoney,
  type Campaign,
  type Currency,
  type State,
} from "@/lib/marketing/model";
import type { Report } from "@/lib/marketing/domain";

type Tab = "overview" | "campaigns" | "partners" | "tracking";
type Data = {
  demo: boolean;
  storage: string;
  campaigns: State["campaigns"];
  partners: State["partners"];
  links: State["links"];
  report: Report;
  recentAudit: State["audit"];
  eventCount: number;
  integrations: { backend: boolean; ads: string };
};
type Editor = {
  kind: "campaign" | "partner" | "link" | "spend";
  campaign?: Campaign;
} | null;
const channelNames = {
  meta: "Meta / Facebook",
  google: "Google Ads",
  affiliate: "พาร์ตเนอร์",
  organic: "Organic",
};
const statusNames = {
  draft: "ฉบับร่าง",
  approved: "อนุมัติในระบบ",
  paused: "พักแคมเปญ",
};
const countryNames: Record<string, string> = {
  TH: "ไทย",
  PH: "ฟิลิปปินส์",
  SG: "สิงคโปร์",
  MY: "มาเลเซีย",
  ID: "อินโดนีเซีย",
  VN: "เวียดนาม",
  KH: "กัมพูชา",
  LA: "ลาว",
  MM: "เมียนมา",
  BN: "บรูไน",
  TL: "ติมอร์-เลสเต",
};

export function MarketingWorkspace() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [editor, setEditor] = useState<Editor>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [filters, setFilters] = useState({ from: "", to: "" });
  const loadData = useCallback(async () => {
    const query = new URLSearchParams();
    if (filters.from) query.set("from", filters.from);
    if (filters.to) query.set("to", filters.to);
    const response = await fetch(`/api/marketing?${query}`, {
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result as Data;
  }, [filters]);
  const refresh = useCallback(async () => {
    setData(await loadData());
  }, [loadData]);
  useEffect(() => {
    let active = true;
    loadData()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [loadData]);
  async function run(command: unknown, endpoint = "/api/marketing") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
      setEditor(null);
      setNotice("บันทึกแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  const total = data?.report.totals.find((item) => item?.currency === currency);
  const rows =
    data?.report.rows.filter((row) => row.currency === currency) ?? [];
  const available = [
    ...new Set(data?.campaigns.map((item) => item.currency) ?? []),
  ];
  const titles: Record<Tab, string> = {
    overview: "รู้ว่าการตลาดสร้างผลลัพธ์อะไร",
    campaigns: "แคมเปญของคุณ",
    partners: "เติบโตไปกับพาร์ตเนอร์",
    tracking: "เชื่อมทุกคลิกกับผลลัพธ์",
  };
  const navigation = [
    { id: "overview" as const, label: "ภาพรวม", icon: BarChart3 },
    { id: "campaigns" as const, label: "แคมเปญ", icon: Megaphone },
    { id: "partners" as const, label: "พาร์ตเนอร์", icon: Users },
    { id: "tracking" as const, label: "ลิงก์ติดตาม", icon: Link2 },
  ];
  return (
    <div className="gm-shell">
      <aside className="gm-sidebar">
        <a className="gm-brand" href="/marketing">
          <span className="gm-mark">G</span>
          <span>
            GOLD MINE<small>MARKETING WORKSPACE</small>
          </span>
        </a>
        <span className="gm-nav-label">พื้นที่ทำงาน</span>
        <nav aria-label="การตลาด">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              {label}
              {tab === id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="gm-sidebar-note">
          <ShieldCheck size={22} />
          <strong>การตัดสินใจอยู่กับคุณ</strong>
          <p>ตรวจแคมเปญและงบก่อนนำไปใช้ในบัญชีโฆษณา</p>
        </div>
        <div className="gm-sidebar-bottom">
          <span className="gm-dot" />
          {data?.demo ? "พื้นที่สาธิตในเครื่อง" : "พื้นที่ผู้ดูแล"}
          <small>Gold Mine Engine · Pilot 01</small>
        </div>
      </aside>
      <main className="gm-main">
        <div className="gm-topbar">
          <span>
            WORKSPACE <span className="gm-slash">/</span> ASEAN
          </span>
          <div>
            {data?.demo && <span className="gm-demo">ข้อมูลสาธิต</span>}
            <button
              className="gm-icon-button"
              title="รีเฟรช"
              aria-label="รีเฟรช"
              onClick={() => refresh().catch((e) => setError(e.message))}
            >
              <RefreshCw size={16} />
            </button>
            {data && !data.demo && (
              <button
                className="gm-text-button"
                onClick={async () => {
                  await fetch("/api/session", { method: "DELETE" });
                  window.location.href = "/login";
                }}
              >
                ออกจากระบบ
              </button>
            )}
          </div>
        </div>
        <header className="gm-page-header">
          <div>
            <p className="gm-eyebrow">YOUR GROWTH, IN FOCUS</p>
            <h1>{titles[tab]}</h1>
            <p>จัดการแคมเปญ ติดตามลูกค้า และมองเห็นต้นทุนอย่างชัดเจน</p>
          </div>
          <button
            className="gm-primary"
            onClick={() =>
              setEditor({
                kind:
                  tab === "partners"
                    ? "partner"
                    : tab === "tracking"
                      ? "link"
                      : "campaign",
              })
            }
          >
            <Plus size={17} />
            {tab === "partners"
              ? "เพิ่มพาร์ตเนอร์"
              : tab === "tracking"
                ? "สร้างลิงก์"
                : "สร้างแคมเปญ"}
          </button>
        </header>
        {error && (
          <div className="gm-alert" role="alert">
            {error}
            <button aria-label="ปิดข้อความ" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="gm-notice" role="status">
            <Check size={16} />
            {notice}
          </div>
        )}
        {!data ? (
          <div className="gm-panel gm-empty">
            <RefreshCw size={28} />
            <h2>{error ? "พื้นที่ทำงานยังไม่พร้อม" : "กำลังโหลดข้อมูล"}</h2>
            <p>
              {error
                ? "ตรวจการตั้งค่าฐานข้อมูล หรือเปิดด้วยโหมดสาธิตในเครื่อง"
                : "กำลังรวบรวมผลลัพธ์ของคุณ"}
            </p>
          </div>
        ) : (
          <>
            {data.demo && data.campaigns.length === 0 && (
              <div className="gm-demo-intro">
                <div>
                  <strong>ทดลองเห็นภาพรวมก่อนเริ่มแคมเปญจริง</strong>
                  <p>โหลดตัวอย่างแคมเปญและผลลัพธ์ลงพื้นที่สาธิตนี้</p>
                </div>
                <button
                  className="gm-secondary"
                  disabled={busy}
                  onClick={() => run({}, "/api/marketing/demo")}
                >
                  โหลดข้อมูลตัวอย่าง
                </button>
              </div>
            )}
            {tab === "overview" && (
              <>
                <form
                  className="gm-filterbar"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setFilters({ from, to });
                  }}
                >
                  <label>
                    สกุลเงิน
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as Currency)}
                    >
                      {[...new Set([...available, currency])].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <div className="gm-date-filter">
                    <label>
                      จาก
                      <input
                        aria-label="วันที่เริ่ม"
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </label>
                    <label>
                      ถึง
                      <input
                        aria-label="วันที่สิ้นสุด"
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </label>
                    <button className="gm-secondary">แสดงผล</button>
                  </div>
                  <span>วันที่อ้างอิง UTC · แยกสกุลเงิน</span>
                </form>
                <div className="gm-kpis">
                  <Metric
                    label="ค่าโฆษณาที่บันทึก"
                    value={moneyText(total?.spendMinor ?? 0, currency)}
                    note="ค่าใช้จ่ายจริงตามวันที่เลือก"
                    icon={<Megaphone size={18} />}
                  />
                  <Metric
                    label="ผู้ฝากครั้งแรก"
                    value={String(total?.firstDepositors ?? 0)}
                    note={`ยอดฝากที่ติดตามได้ ${moneyText(total?.depositsMinor ?? 0, currency)}`}
                    icon={<Users size={18} />}
                  />
                  <Metric
                    label="รายได้สุทธิจากหลังบ้าน"
                    value={moneyText(total?.netRevenueMinor ?? 0, currency)}
                    note="แยกจากยอดฝากเงิน"
                    icon={<CircleDollarSign size={18} />}
                  />
                  <Metric
                    label="ส่วนเหลือหลังค่าการตลาด"
                    value={moneyText(total?.contributionMinor ?? 0, currency)}
                    note="หักค่าโฆษณาและคอมฯ พาร์ตเนอร์"
                    icon={<ArrowUpRight size={18} />}
                    accent
                  />
                </div>
                <section className="gm-panel">
                  <div className="gm-panel-heading">
                    <div>
                      <h2>แคมเปญไหนสร้างผลตอบแทน</h2>
                      <p>เปรียบเทียบต้นทุนกับรายได้ที่ยืนยันจากหลังบ้าน</p>
                    </div>
                    <button
                      className="gm-text-button"
                      onClick={() => setTab("campaigns")}
                    >
                      ดูแคมเปญทั้งหมด <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="gm-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>แคมเปญ</th>
                          <th>คลิก</th>
                          <th>สมัคร</th>
                          <th>ฝากครั้งแรก</th>
                          <th>ต้นทุน / ผู้ฝาก</th>
                          <th>รายได้สุทธิ</th>
                          <th>ROI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.campaignId}>
                            <td>
                              <strong>{row.name}</strong>
                              <small>
                                {channelNames[row.channel]} ·{" "}
                                {countryNames[row.country]}
                              </small>
                            </td>
                            <td>{row.clicks}</td>
                            <td>{row.registrations}</td>
                            <td>{row.firstDepositors}</td>
                            <td>
                              {moneyText(
                                row.costPerFirstDepositorMinor,
                                currency,
                              )}
                            </td>
                            <td>{moneyText(row.netRevenueMinor, currency)}</td>
                            <td>
                              <span
                                className={
                                  row.roi !== null && row.roi < 0
                                    ? "gm-negative"
                                    : "gm-positive"
                                }
                              >
                                {row.roi === null
                                  ? "—"
                                  : `${(row.roi * 100).toFixed(1)}%`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length === 0 && (
                      <Empty text="ยังไม่มีแคมเปญในสกุลเงินนี้" />
                    )}
                  </div>
                </section>
                <div className="gm-bottom-grid">
                  <section className="gm-panel">
                    <div className="gm-panel-heading">
                      <h2>ความพร้อมของข้อมูล</h2>
                      <span className="gm-tag">PILOT</span>
                    </div>
                    <div className="gm-health-row">
                      <span>ข้อมูลจากหลังบ้าน</span>
                      <strong>
                        {data.demo
                          ? "ข้อมูลจำลอง"
                          : data.integrations.backend
                            ? "ตั้งค่ากุญแจแล้ว"
                            : "รอเชื่อมต่อ"}
                      </strong>
                    </div>
                    <div className="gm-health-row">
                      <span>จำนวน event ที่รับแล้ว</span>
                      <strong>{data.eventCount}</strong>
                    </div>
                    <div className="gm-health-row">
                      <span>Event ที่ยังผูกแคมเปญไม่ได้</span>
                      <strong>{data.report.unattributedEvents}</strong>
                    </div>
                    <div className="gm-health-row">
                      <span>การส่งโฆษณา</span>
                      <strong>ส่งออกแผนแคมเปญได้</strong>
                    </div>
                    <p className="gm-footnote">
                      การตั้งค่ากุญแจไม่ใช่การยืนยันว่าเชื่อมต่อสำเร็จ ต้องตรวจ
                      event จากต้นทางให้ตรงกัน
                    </p>
                  </section>
                  <section className="gm-panel gm-insight">
                    <span className="gm-eyebrow">HOW TO READ YOUR NUMBERS</span>
                    <h2>
                      วัดรายได้ที่เกิดขึ้น
                      <br />
                      ควบคู่กับต้นทุน
                    </h2>
                    <p>
                      ส่วนเหลือ = รายได้สุทธิจากหลังบ้าน − ค่าโฆษณา −
                      คอมมิชชันพาร์ตเนอร์
                    </p>
                    <p>
                      ROI ใช้ต้นทุนการตลาดรวม ส่วน ROAS ใช้เฉพาะค่าโฆษณา
                      รายงานนี้ยังไม่ใช่กำไรสุทธิของธุรกิจ
                    </p>
                    <a className="gm-download" href="/api/marketing/export">
                      <ArrowDownToLine size={16} />
                      ดาวน์โหลดรายงานทั้งหมด CSV
                    </a>
                  </section>
                </div>
              </>
            )}
            {tab === "campaigns" && (
              <>
                <div className="gm-section-toolbar">
                  <span>
                    {data.campaigns.length} แคมเปญ · สถานะในพื้นที่ทำงาน
                  </span>
                  <button
                    className="gm-secondary"
                    disabled={!data.campaigns.length}
                    onClick={() => setEditor({ kind: "spend" })}
                  >
                    <CircleDollarSign size={16} />
                    บันทึกค่าโฆษณา
                  </button>
                </div>
                <div className="gm-campaign-grid">
                  {data.campaigns.map((campaign) => (
                    <article className="gm-panel gm-campaign" key={campaign.id}>
                      <div className="gm-campaign-top">
                        <span className="gm-channel-icon">
                          <Megaphone size={22} />
                        </span>
                        <span className={`gm-status ${campaign.status}`}>
                          {statusNames[campaign.status]}
                        </span>
                      </div>
                      <h2>{campaign.name}</h2>
                      <p>
                        {channelNames[campaign.channel]} ·{" "}
                        {countryNames[campaign.country]} · {campaign.currency}
                      </p>
                      <dl>
                        <div>
                          <dt>งบแคมเปญที่วางไว้</dt>
                          <dd>
                            {moneyText(campaign.budgetMinor, campaign.currency)}
                          </dd>
                        </div>
                        <div>
                          <dt>เว็บไซต์ปลายทาง</dt>
                          <dd>
                            {campaign.landingUrl
                              ? new URL(campaign.landingUrl).hostname
                              : "รอระบุเว็บไซต์"}
                          </dd>
                        </div>
                      </dl>
                      <div className="gm-campaign-actions">
                        <button
                          className="gm-secondary"
                          onClick={() =>
                            setEditor({ kind: "campaign", campaign })
                          }
                        >
                          แก้ไข
                        </button>
                        <button
                          className="gm-secondary"
                          disabled={busy}
                          onClick={() =>
                            run({
                              type: "campaign.status",
                              id: campaign.id,
                              status:
                                campaign.status === "approved"
                                  ? "paused"
                                  : "approved",
                            })
                          }
                        >
                          {campaign.status === "approved"
                            ? "พักแคมเปญ"
                            : "อนุมัติในระบบ"}
                        </button>
                        <a
                          aria-label={`ส่งออกแผน ${campaign.name}`}
                          className="gm-icon-button"
                          href={`/api/marketing/export?campaignId=${campaign.id}`}
                        >
                          <ArrowDownToLine size={17} />
                        </a>
                      </div>
                      <small className="gm-footnote">
                        ยังไม่ได้ส่งเข้าบัญชีโฆษณา
                      </small>
                    </article>
                  ))}
                </div>
                {!data.campaigns.length && (
                  <Empty text="สร้างแคมเปญแรกเพื่อเริ่มวางงบและวัดผล" />
                )}
              </>
            )}
            {tab === "partners" && (
              <section className="gm-panel">
                <div className="gm-panel-heading">
                  <div>
                    <h2>เครือข่ายพาร์ตเนอร์</h2>
                    <p>
                      คอมมิชชันคงที่ต่อผู้ฝากครั้งแรกที่ติดตามได้ ·
                      ยังไม่มีการจ่ายเงินจริง
                    </p>
                  </div>
                </div>
                <div className="gm-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>พาร์ตเนอร์</th>
                        <th>คอมฯ / ผู้ฝากครั้งแรก</th>
                        <th>ผู้ฝากครั้งแรก</th>
                        <th>คอมฯ ประมาณการ</th>
                        <th>สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.partners.map((partner) => {
                        const result = data.report.partners.find(
                          (item) => item.id === partner.id,
                        );
                        return (
                          <tr key={partner.id}>
                            <td>
                              <strong>{partner.name}</strong>
                              <small>{partner.currency}</small>
                            </td>
                            <td>
                              {moneyText(partner.cpaMinor, partner.currency)}
                            </td>
                            <td>{result?.firstDepositors ?? 0}</td>
                            <td>
                              {moneyText(
                                result?.commissionMinor ?? 0,
                                partner.currency,
                              )}
                            </td>
                            <td>
                              <button
                                className="gm-secondary"
                                disabled={busy}
                                onClick={() =>
                                  run({
                                    type: "partner.status",
                                    id: partner.id,
                                    active: !partner.active,
                                  })
                                }
                              >
                                {partner.active
                                  ? "เปิดใช้งาน · กดเพื่อพัก"
                                  : "พักอยู่ · กดเพื่อเปิด"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!data.partners.length && (
                    <Empty text="เพิ่มพาร์ตเนอร์และกำหนดค่าตอบแทนก่อนสร้างลิงก์" />
                  )}
                </div>
              </section>
            )}
            {tab === "tracking" && (
              <section className="gm-panel">
                <div className="gm-panel-heading">
                  <div>
                    <h2>ลิงก์ของแคมเปญและพาร์ตเนอร์</h2>
                    <p>
                      เปิดใช้เมื่อแคมเปญผ่านการอนุมัติในระบบและระบุเว็บไซต์แล้ว
                    </p>
                  </div>
                </div>
                {data.links.map((link) => {
                  const campaign = data.campaigns.find(
                    (item) => item.id === link.campaignId,
                  )!;
                  const partner = data.partners.find(
                    (item) => item.id === link.partnerId,
                  );
                  return (
                    <div className="gm-link-row" key={link.id}>
                      <div>
                        <strong>{campaign.name}</strong>
                        <small>
                          {partner?.name ?? "แคมเปญโดยตรง"} ·{" "}
                          {statusNames[campaign.status]}
                        </small>
                        <code>{`/go/${link.code}`}</code>
                      </div>
                      <button
                        className="gm-secondary"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              `${window.location.origin}/go/${link.code}`,
                            );
                            setNotice("คัดลอกลิงก์แล้ว");
                          } catch {
                            setError(
                              "คัดลอกไม่สำเร็จ กรุณาคัดลอกเส้นทางลิงก์ด้านซ้าย",
                            );
                          }
                        }}
                      >
                        <Copy size={15} />
                        คัดลอก
                      </button>
                    </div>
                  );
                })}
                {!data.links.length && (
                  <Empty text="สร้างลิงก์แยกให้แต่ละแคมเปญหรือพาร์ตเนอร์" />
                )}
                <p className="gm-footnote gm-pad">
                  จำนวนคลิกเป็นจำนวนการเปิดลิงก์ ยังไม่ใช่จำนวนคนไม่ซ้ำ
                  ระบบเกมต้องส่งผลสมัคร/ฝากสำเร็จกลับมาเพื่อวัด conversion
                </p>
              </section>
            )}
          </>
        )}
        <footer className="gm-footer">
          GOLD MINE ENGINE{" "}
          <span>ข้อมูลที่ตรวจสอบได้ เพื่อการตัดสินใจที่ดีขึ้น</span>
        </footer>
      </main>
      {editor && (
        <EditorDialog
          editor={editor}
          data={data}
          busy={busy}
          error={error}
          onClose={() => setEditor(null)}
          onSave={run}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <section className={`gm-metric ${accent ? "gm-metric-accent" : ""}`}>
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="gm-empty">
      <BarChart3 size={25} />
      <p>{text}</p>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="gm-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function EditorDialog({
  editor,
  data,
  busy,
  error,
  onClose,
  onSave,
}: {
  editor: NonNullable<Editor>;
  data: Data | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (command: unknown) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [currency, setCurrency] = useState<Currency>(
    editor.campaign?.currency ?? "USD",
  );
  const [localError, setLocalError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const title = {
    campaign: editor.campaign ? "แก้ไขแคมเปญ" : "สร้างแคมเปญ",
    partner: "เพิ่มพาร์ตเนอร์",
    link: "สร้างลิงก์ติดตาม",
    spend: "บันทึกค่าโฆษณารายวัน",
  }[editor.kind];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    const form = new FormData(event.currentTarget),
      value = (key: string) => String(form.get(key) ?? "");
    try {
      if (editor.kind === "campaign") {
        const input = {
          name: value("name"),
          country: value("country"),
          currency,
          channel: value("channel"),
          budgetMinor: parseMoney(value("budget"), currency),
          landingUrl: value("landingUrl"),
          minimumAge: value("minimumAge") ? Number(value("minimumAge")) : null,
          marketReference: value("marketReference"),
          platformReference: value("platformReference"),
        };
        await onSave(
          editor.campaign
            ? { type: "campaign.update", id: editor.campaign.id, input }
            : { type: "campaign.create", input },
        );
      } else if (editor.kind === "partner")
        await onSave({
          type: "partner.create",
          input: {
            name: value("name"),
            currency,
            cpaMinor: parseMoney(value("cpa"), currency),
          },
        });
      else if (editor.kind === "link")
        await onSave({
          type: "link.create",
          campaignId: value("campaignId"),
          partnerId: value("partnerId") || null,
        });
      else {
        const campaign = data?.campaigns.find(
          (item) => item.id === value("campaignId"),
        );
        if (!campaign) throw new Error("กรุณาเลือกแคมเปญ");
        await onSave({
          type: "spend.set",
          campaignId: campaign.id,
          date: value("date"),
          amountMinor: parseMoney(value("amount"), campaign.currency),
        });
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "ข้อมูลไม่ถูกต้อง");
    }
  }
  return (
    <dialog
      className="gm-dialog"
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="gm-dialog-title">
        <h2>{title}</h2>
        <button
          className="gm-icon-button"
          aria-label="ปิดหน้าต่าง"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <form onSubmit={submit}>
        {(localError || error) && (
          <p role="alert" className="gm-alert">
            {localError || error}
          </p>
        )}
        {["campaign", "partner"].includes(editor.kind) && (
          <>
            <Field
              label={
                editor.kind === "campaign" ? "ชื่อแคมเปญ" : "ชื่อพาร์ตเนอร์"
              }
            >
              <input
                autoFocus
                name="name"
                maxLength={160}
                required
                defaultValue={editor.campaign?.name}
              />
            </Field>
            <Field label="สกุลเงิน">
              <select
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value as Currency)
                }
              >
                {currencies.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
          </>
        )}
        {editor.kind === "campaign" && (
          <>
            <div className="gm-form-grid">
              <Field label="ประเทศ">
                <select
                  name="country"
                  defaultValue={editor.campaign?.country ?? "PH"}
                >
                  {countries.map((item) => (
                    <option key={item} value={item}>
                      {countryNames[item]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ช่องทาง">
                <select
                  name="channel"
                  defaultValue={editor.campaign?.channel ?? "meta"}
                >
                  {Object.entries(channelNames).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="งบแคมเปญที่วางไว้">
              <input
                name="budget"
                inputMode="decimal"
                required
                defaultValue={
                  editor.campaign
                    ? editor.campaign.budgetMinor /
                      (editor.campaign.currency === "VND" ? 1 : 100)
                    : "0"
                }
              />
            </Field>
            <Field label="เว็บไซต์ปลายทาง (เว้นว่างได้ขณะร่าง)">
              <input
                name="landingUrl"
                placeholder="https://"
                defaultValue={editor.campaign?.landingUrl}
              />
            </Field>
            <details className="gm-approval-fields">
              <summary>ข้อมูลก่อนอนุมัติแคมเปญ</summary>
              <Field label="อายุขั้นต่ำตามตลาด">
                <input
                  name="minimumAge"
                  type="number"
                  min="18"
                  max="99"
                  defaultValue={editor.campaign?.minimumAge ?? ""}
                />
              </Field>
              <Field label="เอกสารอ้างอิงสิทธิ์ดำเนินการในตลาด">
                <input
                  name="marketReference"
                  maxLength={500}
                  defaultValue={editor.campaign?.marketReference}
                />
              </Field>
              <Field label="เอกสารอ้างอิงการอนุญาตของแพลตฟอร์มโฆษณา">
                <input
                  name="platformReference"
                  maxLength={500}
                  defaultValue={editor.campaign?.platformReference}
                />
              </Field>
              <p>
                ผู้ดูแลตรวจเอกสารก่อนอนุมัติ
                การกรอกข้อมูลไม่ได้ยืนยันสิทธิ์โดยอัตโนมัติ
              </p>
            </details>
            <p className="gm-footnote">
              บันทึกเป็นฉบับร่าง การแก้ไขจะต้องอนุมัติในระบบใหม่
            </p>
          </>
        )}
        {editor.kind === "partner" && (
          <Field label="ค่าตอบแทนต่อผู้ฝากครั้งแรก">
            <input name="cpa" inputMode="decimal" defaultValue="0" required />
          </Field>
        )}
        {["link", "spend"].includes(editor.kind) && (
          <Field label="แคมเปญ">
            <select name="campaignId" required>
              <option value="">เลือกแคมเปญ</option>
              {data?.campaigns.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.currency}
                </option>
              ))}
            </select>
          </Field>
        )}
        {editor.kind === "link" && (
          <Field label="พาร์ตเนอร์">
            <select name="partnerId">
              <option value="">แคมเปญโดยตรง</option>
              {data?.partners
                .filter((item) => item.active)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.currency}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {editor.kind === "spend" && (
          <>
            <Field label="วันที่ค่าใช้จ่าย (UTC)">
              <input
                name="date"
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </Field>
            <Field label="ค่าโฆษณาจริง (สกุลเงินของแคมเปญ)">
              <input name="amount" inputMode="decimal" required />
            </Field>
            <p className="gm-footnote">
              ใช้ยอดรวมของวันนั้น หากบันทึกวันเดิมจะปรับยอดเดิม ไม่บวกซ้ำ
            </p>
          </>
        )}
        <div className="gm-dialog-actions">
          <button
            type="button"
            className="gm-secondary"
            disabled={busy}
            onClick={onClose}
          >
            ยกเลิก
          </button>
          <button className="gm-primary" disabled={busy}>
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
