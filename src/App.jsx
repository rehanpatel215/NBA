import { useState, useMemo, useEffect } from "react";

/* ─────────────────────────────────────────────
   MOCK DATABASE  (replace with Firebase in prod)
───────────────────────────────────────────── */
const KNOWN_ORGS = [
  "ieee","acm","nptel","coursera","udemy","infosys","tcs","wipro","cognizant","google",
  "amazon","microsoft","mit","iit bombay","iit madras","iit delhi","nit","mhrd","dd india",
  "springer","elsevier","aws","oracle","ibm","nasscom","hack2skill","devfolio","unstop",
  "hackerearth","hackerrank","linkedin learning","simplilearn","great learning","swayam",
  "samsung","qualcomm","intel","nvidia","adobe","meta","flipkart","myntra","zoho",
  "freshworks","byju's","unacademy","internshala","let's intern"
];

const DEMO_USERS = [
  { id:"s1", role:"student", name:"Arjun Sharma",   email:"arjun@college.edu",   password:"student123", rollNo:"21CS001", branch:"CSE", year:"3rd Year", avatar:"AS" },
  { id:"s2", role:"student", name:"Priya Nair",     email:"priya@college.edu",   password:"student123", rollNo:"21CS002", branch:"CSE", year:"3rd Year", avatar:"PN" },
  { id:"f1", role:"faculty", name:"Dr. Meera Rao",  email:"meera@college.edu",   password:"faculty123", branch:"CSE", designation:"Associate Professor", avatar:"MR" },
  { id:"f2", role:"faculty", name:"Prof. Suresh K", email:"suresh@college.edu",  password:"faculty123", branch:"ECE", designation:"Professor", avatar:"SK" },
  { id:"d1", role:"hod",     name:"Dr. Ramesh Iyer",email:"hod@college.edu",     password:"hod123",     branch:"ALL", designation:"Head of Department", avatar:"RI" },
];

const INITIAL_ENTRIES = [
  { id:"e1", studentId:"s1", studentName:"Arjun Sharma", rollNo:"21CS001", branch:"CSE", year:"3rd Year",
    category:"Hackathon", title:"Smart India Hackathon 2024", organizer:"MHRD", date:"2024-08-15",
    position:"Winner", level:"National", hasCertificate:true, qrScanned:true,
    status:"approved", aiScore:95, aiFlags:[], addedBy:"student", submittedAt:"2024-08-20",
    mentorNote:"" },
  { id:"e2", studentId:"s2", studentName:"Priya Nair", rollNo:"21CS002", branch:"CSE", year:"3rd Year",
    category:"Certification", title:"AWS Cloud Practitioner", organizer:"Amazon Web Services", date:"2024-07-20",
    position:"Certified", level:"International", hasCertificate:true, qrScanned:false,
    status:"flagged", aiScore:62, aiFlags:["QR code not scanned — certificate authenticity unverified","Organizer name slightly ambiguous ('Amazon Web Services' vs 'AWS')"],
    addedBy:"student", submittedAt:"2024-07-22", mentorNote:"" },
  { id:"e3", studentId:"s1", studentName:"Arjun Sharma", rollNo:"21CS001", branch:"CSE", year:"3rd Year",
    category:"Workshop", title:"ML & AI Bootcamp", organizer:"IIT Bombay", date:"2028-09-10",
    position:"Participated", level:"National", hasCertificate:false, qrScanned:false,
    status:"flagged", aiScore:30, aiFlags:["Date is in the future (2028) — likely a typo","No certificate attached — cannot verify participation"],
    addedBy:"student", submittedAt:"2024-09-11", mentorNote:"" },
  { id:"e4", studentId:"s2", studentName:"Priya Nair", rollNo:"21CS002", branch:"CSE", year:"3rd Year",
    category:"Conference", title:"International Conf on AI", organizer:"Springer", date:"2024-12-01",
    position:"Paper Accepted", level:"International", hasCertificate:true, qrScanned:true,
    status:"approved", aiScore:97, aiFlags:[], addedBy:"student", submittedAt:"2024-12-03", mentorNote:"" },
  { id:"e5", studentId:"f1", studentName:"Dr. Meera Rao", rollNo:"—", branch:"CSE", year:"Faculty",
    category:"Research Mentorship", title:"Deep Learning Research Group — Mentored 6 students",
    organizer:"CSE Dept", date:"2024-06-01", position:"Mentor", level:"Institutional",
    hasCertificate:false, qrScanned:false, status:"approved", aiScore:100, aiFlags:[],
    addedBy:"faculty", submittedAt:"2024-06-05", mentorNote:"https://github.com/lab/dl-research-2024",
    mentees:["Arjun Sharma","Priya Nair","Rahul Verma"] },
];

const NOTIFICATIONS_INIT = [
  { id:"n1", to:"f1", from:"system", message:"New flagged entry: 'AWS Cloud Practitioner' by Priya Nair needs review", read:false, time:"2024-07-22", entryId:"e2" },
  { id:"n2", to:"f1", from:"system", message:"New flagged entry: 'ML & AI Bootcamp' by Arjun Sharma needs review — future date detected", read:false, time:"2024-09-11", entryId:"e3" },
  { id:"n3", to:"d1", from:"system", message:"2 entries pending manual review in CSE department", read:false, time:"2024-09-11", entryId:null },
];

/* ─────────────────────────────────────────────
   AI VALIDATION ENGINE
───────────────────────────────────────────── */
function runAIValidation(entry, allEntries, currentUserId) {
  const flags = [];
  let score = 100;

  // 1. Future date
  if (entry.date && new Date(entry.date) > new Date()) {
    flags.push("Date is in the future — likely a typo or incorrect entry");
    score -= 40;
  }

  // 2. Duplicate
  const dup = allEntries.find(e =>
    e.studentId === currentUserId &&
    e.title.toLowerCase() === entry.title.toLowerCase() &&
    e.date === entry.date
  );
  if (dup) { flags.push("Possible duplicate — same title and date already submitted"); score -= 35; }

  // 3. Missing certificate
  if (!entry.hasCertificate) { flags.push("No certificate attached — participation cannot be verified"); score -= 20; }

  // 4. QR not scanned
  if (entry.hasCertificate && !entry.qrScanned) {
    flags.push("Certificate QR code not scanned — authenticity unverified");
    score -= 15;
  }

  // 5. Organizer check
  const orgLower = (entry.organizer || "").toLowerCase();
  const known = KNOWN_ORGS.some(o => orgLower.includes(o));
  if (!known && orgLower.length > 2) {
    flags.push(`Organizer "${entry.organizer}" is not in the verified organizer database — requires manual verification`);
    score -= 25;
  }

  // 6. Level vs organizer mismatch
  if (entry.level === "International" && !["international","global","ieee","acm","springer","mit","google","amazon","microsoft"].some(k => orgLower.includes(k))) {
    flags.push("Level marked 'International' but organizer does not appear to be an international body");
    score -= 10;
  }

  score = Math.max(0, score);
  const status = flags.length === 0 ? "approved" : "flagged";
  return { flags, score, status };
}

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const CATEGORIES = ["Hackathon","Workshop","Certification","Internship","Conference","Competition","Research Mentorship","Project"];
const YEARS = ["1st Year","2nd Year","3rd Year","4th Year"];
const BRANCHES = ["CSE","ECE","MECH","CIVIL","EEE"];
const LEVELS = ["International","National","State","Industry","Institutional"];
const catColors = { Hackathon:"#f59e0b", Workshop:"#3b82f6", Certification:"#10b981", Internship:"#8b5cf6", Conference:"#ef4444", Competition:"#ec4899", "Research Mentorship":"#06b6d4", Project:"#84cc16" };
const catIcons  = { Hackathon:"⚡", Workshop:"🔧", Certification:"🏅", Internship:"💼", Conference:"🎤", Competition:"🏆", "Research Mentorship":"🔬", Project:"📐" };

/* ─────────────────────────────────────────────
   STYLES
───────────────────────────────────────────── */
const G = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#060912}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:3px}
.syne{font-family:'Syne',sans-serif}
.mono{font-family:'DM Mono',monospace}
.sans{font-family:'DM Sans',sans-serif}

/* Layout */
.shell{display:flex;min-height:100vh;background:#060912;color:#e2e8f0;font-family:'DM Sans',sans-serif}
.sidebar{width:240px;min-height:100vh;background:#080d1a;border-right:1px solid #0f1929;display:flex;flex-direction:column;flex-shrink:0;transition:transform .25s ease;z-index:50}
.main{flex:1;overflow-y:auto;min-height:100vh;min-width:0}
.topbar{background:#080d1a;border-bottom:1px solid #0f1929;padding:0 16px;height:60px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
.content{padding:28px}
@media(max-width:768px){
  .shell{flex-direction:column}
  .sidebar{width:100%;min-height:unset;flex-direction:row;flex-wrap:wrap;border-right:none;border-bottom:1px solid #0f1929;position:sticky;top:0;z-index:50;overflow-x:auto}
  .logo-wrap{display:none}
  .nav-section{display:none}
  .nav-item{padding:10px 14px;border-left:none !important;border-bottom:3px solid transparent;font-size:12px;white-space:nowrap}
  .nav-item.active{border-bottom-color:#38bdf8 !important;border-left:none !important}
  .main{min-height:unset}
  .content{padding:16px}
  .topbar{padding:0 12px;height:52px}
}

/* Sidebar */
.logo-wrap{padding:20px 20px 16px;border-bottom:1px solid #0f1929}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:13px;color:#475569;transition:.15s;border-left:3px solid transparent;letter-spacing:.02em}
.nav-item:hover{color:#94a3b8;background:#0a1120}
.nav-item.active{color:#38bdf8;border-left-color:#38bdf8;background:#0a1120}
.nav-section{padding:16px 20px 6px;font-size:10px;color:#1e3a5f;letter-spacing:.15em;text-transform:uppercase;font-family:'DM Mono',monospace}

/* Cards */
.card{background:#0a1120;border:1px solid #0f1929;border-radius:14px;padding:22px}
.kpi{background:linear-gradient(135deg,#0a1120 0%,#0d1528 100%);border:1px solid #0f1929;border-radius:14px;padding:22px;transition:.2s}
.kpi:hover{transform:translateY(-2px);border-color:#1e3a5f}

/* Table */
.tbl-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:10px 14px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#1e3a5f;border-bottom:1px solid #0f1929;white-space:nowrap}
td{padding:11px 14px;border-bottom:1px solid #080d1a;color:#94a3b8;vertical-align:middle}
tr:hover td{background:#0a1120}

/* Badges */
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-family:'DM Mono',monospace;font-weight:500;white-space:nowrap}

/* Buttons */
.btn{border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;transition:.15s;letter-spacing:.02em}
.btn-blue{background:#1d4ed8;color:#fff}.btn-blue:hover{background:#2563eb}
.btn-green{background:#065f46;color:#6ee7b7}.btn-green:hover{background:#047857}
.btn-red{background:#7f1d1d;color:#fca5a5}.btn-red:hover{background:#991b1b}
.btn-ghost{background:#0f1929;color:#64748b;border:1px solid #1e293b}.btn-ghost:hover{background:#1e293b;color:#94a3b8}
.btn-amber{background:#92400e;color:#fde68a}.btn-amber:hover{background:#b45309}
.btn-sm{padding:5px 12px;font-size:12px;border-radius:6px}

/* Forms */
.inp{width:100%;background:#080d1a;border:1px solid #1e293b;color:#e2e8f0;padding:10px 14px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:14px}
.inp:focus{outline:none;border-color:#38bdf8}
.inp::placeholder{color:#334155}
.lbl{font-size:11px;color:#334155;margin-bottom:5px;letter-spacing:.08em;text-transform:uppercase;font-family:'DM Mono',monospace}

/* Status */
.dot-green{width:7px;height:7px;border-radius:50%;background:#10b981;display:inline-block}
.dot-amber{width:7px;height:7px;border-radius:50%;background:#f59e0b;display:inline-block}
.dot-red  {width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block}
.dot-blue {width:7px;height:7px;border-radius:50%;background:#38bdf8;display:inline-block}

/* Animations */
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp .35s ease}
@keyframes spin{to{transform:rotate(360deg)}}
.spin{animation:spin 1s linear infinite}
@keyframes pulse2{0%,100%{opacity:1}50%{opacity:.5}}
.pulse{animation:pulse2 1.5s infinite}

/* Login */
.login-bg{min-height:100vh;width:100%;background:#060912;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.login-card{background:#080d1a;border:1px solid #0f1929;border-radius:20px;padding:44px;width:420px;max-width:92vw;position:relative;z-index:1;margin:auto}
.orb{position:absolute;border-radius:50%;filter:blur(80px);opacity:.4}

/* AI bar */
.ai-bar-wrap{height:6px;background:#0f1929;border-radius:3px;overflow:hidden;margin-top:4px}
.ai-bar{height:100%;border-radius:3px;transition:width .8s ease}

/* Notif dot */
.notif-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:50%;width:16px;height:16px;font-size:9px;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace}

/* Role pill */
.role-pill{padding:3px 10px;border-radius:20px;font-size:10px;font-family:'DM Mono',monospace;letter-spacing:.08em;text-transform:uppercase}

/* Tabs */
.tab{padding:8px 18px;border:none;background:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;color:#334155;border-bottom:2px solid transparent;transition:.15s}
.tab.active{color:#38bdf8;border-bottom-color:#38bdf8}
.tab:hover{color:#64748b}

/* QR Scanner mock */
.qr-box{background:#080d1a;border:2px dashed #1e3a5f;border-radius:12px;padding:30px;text-align:center;cursor:pointer;transition:.2s}
.qr-box:hover{border-color:#38bdf8}

/* Scrollable flags */
.flag-item{background:#1c0a0a;border:1px solid #7f1d1d33;border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:#fca5a5;display:flex;gap:10px;align-items:flex-start}

/* Score ring */
.score-ring{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:14px;font-weight:700;flex-shrink:0}

@media(max-width:768px){
  .kpi-grid{grid-template-columns:1fr 1fr !important}
  .two-col{grid-template-columns:1fr !important}
  .four-col{grid-template-columns:1fr 1fr !important}
  .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .login-card{width:92vw;padding:28px 20px}
  .score-ring{width:44px;height:44px}
}
@media(max-width:480px){
  .kpi-grid{grid-template-columns:1fr !important}
  .four-col{grid-template-columns:1fr !important}
}

`;

/* ─────────────────────────────────────────────
   MAIN APP
───────────────────────────────────────────── */
export default function App() {
  const [user, setUser]       = useState(null);
  const [entries, setEntries] = useState(INITIAL_ENTRIES);
  const [notifs, setNotifs]   = useState(NOTIFICATIONS_INIT);
  const [page, setPage]       = useState("dashboard");
  const [loginForm, setLoginForm] = useState({ email:"", password:"" });
  const [loginErr, setLoginErr]   = useState("");
  const [showNotifs, setShowNotifs] = useState(false);

  const myNotifs = user ? notifs.filter(n => n.to === user.id && !n.read) : [];

  const login = () => {
    const found = DEMO_USERS.find(u => u.email === loginForm.email && u.password === loginForm.password);
    if (!found) { setLoginErr("Invalid credentials. Try the demo accounts below."); return; }
    setUser(found);
    setLoginErr("");
    setPage("dashboard");
  };

  const logout = () => { setUser(null); setPage("dashboard"); };

  const markNotifsRead = () => {
    setNotifs(p => p.map(n => n.to === user?.id ? { ...n, read:true } : n));
    setShowNotifs(false);
  };

  if (!user) return <LoginScreen form={loginForm} setForm={setLoginForm} onLogin={login} err={loginErr} />;

  return (
    <>
      <style>{G}</style>
      <div className="shell">
        <Sidebar user={user} page={page} setPage={setPage} logout={logout} />
        <div className="main">
          <Topbar user={user} myNotifs={myNotifs} showNotifs={showNotifs} setShowNotifs={setShowNotifs} markNotifsRead={markNotifsRead} notifs={notifs} />
          <div className="content fu">
            {page === "dashboard" && <Dashboard user={user} entries={entries} />}
            {page === "submit"    && <SubmitAchievement user={user} entries={entries} setEntries={setEntries} setNotifs={setNotifs} />}
            {page === "myrecords" && <MyRecords user={user} entries={entries} setEntries={setEntries} />}
            {page === "review"    && <ReviewQueue user={user} entries={entries} setEntries={setEntries} />}
            {page === "allrecords"&& <AllRecords user={user} entries={entries} />}
            {page === "addentry"  && <FacultyAddEntry user={user} entries={entries} setEntries={setEntries} />}
            {page === "mentorship"&& <MentorshipLog user={user} entries={entries} setEntries={setEntries} />}
            {page === "report"    && <NBAReport user={user} entries={entries} />}
            {page === "users"     && <ManageUsers />}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   LOGIN
───────────────────────────────────────────── */
function LoginScreen({ form, setForm, onLogin, err }) {
  return (
    <>
      <style>{G}</style>
      <div className="login-bg">
        <div className="orb" style={{ width:400,height:400,background:"#1d4ed8",top:-100,left:-100 }} />
        <div className="orb" style={{ width:300,height:300,background:"#0891b2",bottom:-80,right:-80 }} />
        <div className="login-card fu">
          <div style={{ textAlign:"center", marginBottom:32 }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🎓</div>
            <h1 className="syne" style={{ fontSize:22, fontWeight:800, color:"#f1f5f9", letterSpacing:"-0.02em" }}>NBA Criterion 4</h1>
            <p className="mono" style={{ fontSize:11, color:"#334155", letterSpacing:".1em", marginTop:4 }}>STUDENT ACHIEVEMENT INTELLIGENCE</p>
          </div>

          <div style={{ marginBottom:14 }}>
            <div className="lbl">Email</div>
            <input className="inp" placeholder="your@college.edu" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&onLogin()} />
          </div>
          <div style={{ marginBottom:20 }}>
            <div className="lbl">Password</div>
            <input className="inp" type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&onLogin()} />
          </div>
          {err && <div style={{ background:"#1c0a0a",border:"1px solid #7f1d1d44",borderRadius:8,padding:"10px 14px",color:"#fca5a5",fontSize:13,marginBottom:16 }}>{err}</div>}
          <button className="btn btn-blue" style={{ width:"100%",padding:"11px",fontSize:14 }} onClick={onLogin}>Sign In →</button>

          <div style={{ marginTop:28, borderTop:"1px solid #0f1929", paddingTop:20 }}>
            <div className="lbl" style={{ marginBottom:10, color:"#1e3a5f" }}>Demo Accounts</div>
            {[
              { label:"Student",  email:"arjun@college.edu",  pw:"student123", color:"#38bdf8" },
              { label:"Faculty",  email:"meera@college.edu",  pw:"faculty123", color:"#10b981" },
              { label:"HOD/Admin",email:"hod@college.edu",    pw:"hod123",     color:"#f59e0b" },
            ].map(d => (
              <div key={d.label} onClick={() => setForm({ email:d.email, password:d.pw })}
                style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderRadius:8,cursor:"pointer",border:"1px solid #0f1929",marginBottom:6,transition:".15s" }}
                onMouseEnter={e=>e.currentTarget.style.background="#0a1120"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                <span style={{ color:d.color,fontSize:12,fontFamily:"'DM Mono',monospace" }}>{d.label}</span>
                <span style={{ color:"#334155",fontSize:11,fontFamily:"'DM Mono',monospace" }}>{d.email}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────── */
function Sidebar({ user, page, setPage, logout }) {
  const studentNav = [
    { key:"dashboard",  icon:"▦",  label:"Dashboard"    },
    { key:"submit",     icon:"＋",  label:"Submit Achievement" },
    { key:"myrecords",  icon:"☰",  label:"My Records"   },
  ];
  const facultyNav = [
    { key:"dashboard",  icon:"▦",  label:"Dashboard"    },
    { key:"review",     icon:"🔍", label:"Review Queue" },
    { key:"allrecords", icon:"☰",  label:"All Records"  },
    { key:"addentry",   icon:"＋",  label:"Add Event / Entry" },
    { key:"mentorship", icon:"🔬", label:"Mentorship Log" },
    { key:"report",     icon:"📄", label:"NBA Report"   },
  ];
  const hodNav = [
    { key:"dashboard",  icon:"▦",  label:"Dashboard"    },
    { key:"review",     icon:"🔍", label:"Review Queue" },
    { key:"allrecords", icon:"☰",  label:"All Records"  },
    { key:"addentry",   icon:"＋",  label:"Add Dept Event" },
    { key:"report",     icon:"📄", label:"NBA Report"   },
    { key:"users",      icon:"👤", label:"Manage Users" },
  ];
  const nav = user.role==="student" ? studentNav : user.role==="faculty" ? facultyNav : hodNav;

  const roleColor = user.role==="student" ? "#38bdf8" : user.role==="faculty" ? "#10b981" : "#f59e0b";
  const roleName  = user.role==="hod" ? "HOD / Admin" : user.role.charAt(0).toUpperCase()+user.role.slice(1);

  return (
    <div className="sidebar">
      <div className="logo-wrap">
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
          <div style={{ width:32,height:32,background:"linear-gradient(135deg,#1d4ed8,#0891b2)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🎓</div>
          <div>
            <div className="mono" style={{ fontSize:9,color:"#1e3a5f",letterSpacing:".15em",textTransform:"uppercase" }}>NBA Cr.4</div>
            <div className="syne" style={{ fontSize:13,fontWeight:700,color:"#e2e8f0",lineHeight:1 }}>Achievement Hub</div>
          </div>
        </div>
        {/* User pill */}
        <div style={{ background:"#0a1120",borderRadius:10,padding:"10px 12px",border:"1px solid #0f1929" }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <div style={{ width:30,height:30,borderRadius:8,background:`${roleColor}22`,border:`1px solid ${roleColor}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"'DM Mono',monospace",color:roleColor,fontWeight:700,flexShrink:0 }}>{user.avatar}</div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:12,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.name}</div>
              <div className="role-pill" style={{ background:`${roleColor}18`,color:roleColor,marginTop:2 }}>{roleName}</div>
            </div>
          </div>
        </div>
      </div>

      <nav style={{ flex:1,paddingTop:8 }}>
        {nav.map(n => (
          <div key={n.key} className={`nav-item ${page===n.key?"active":""}`} onClick={()=>setPage(n.key)}>
            <span style={{ fontSize:14 }}>{n.icon}</span>
            <span>{n.label}</span>
          </div>
        ))}
      </nav>

      <div style={{ padding:"16px 20px",borderTop:"1px solid #0f1929" }}>
        <div className="nav-item" style={{ paddingLeft:0,paddingRight:0 }} onClick={logout}>
          <span>⎋</span><span style={{ fontSize:13 }}>Sign Out</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TOPBAR
───────────────────────────────────────────── */
function Topbar({ user, myNotifs, showNotifs, setShowNotifs, markNotifsRead, notifs }) {
  return (
    <div className="topbar">
      <div>
        <span className="syne" style={{ fontSize:15,fontWeight:700,color:"#e2e8f0" }}>
          {user.role==="student" ? `Welcome, ${user.name.split(" ")[0]} 👋` : user.role==="faculty" ? `Faculty Portal — ${user.branch}` : "HOD Dashboard — All Departments"}
        </span>
        {user.branch && user.branch !== "ALL" && <span className="mono" style={{ fontSize:11,color:"#334155",marginLeft:14 }}>Dept: {user.branch}</span>}
      </div>
      <div style={{ display:"flex",alignItems:"center",gap:14 }}>
        <div style={{ position:"relative" }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setShowNotifs(p=>!p)} style={{ position:"relative" }}>
            🔔 {myNotifs.length > 0 && <span className="notif-badge">{myNotifs.length}</span>}
          </button>
          {showNotifs && (
            <div style={{ position:"absolute",right:0,top:"calc(100% + 8px)",width:340,background:"#080d1a",border:"1px solid #0f1929",borderRadius:12,zIndex:100,padding:12 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <span style={{ fontSize:12,color:"#64748b",fontFamily:"'DM Mono',monospace" }}>NOTIFICATIONS</span>
                <button className="btn btn-ghost btn-sm" onClick={markNotifsRead} style={{ fontSize:11 }}>Mark all read</button>
              </div>
              {notifs.filter(n=>n.to===user.id).length === 0
                ? <div style={{ color:"#334155",fontSize:13,textAlign:"center",padding:20 }}>No notifications</div>
                : notifs.filter(n=>n.to===user.id).slice(0,5).map(n=>(
                  <div key={n.id} style={{ padding:"10px 12px",borderRadius:8,marginBottom:6,background:n.read?"#0a1120":"#0d1528",border:"1px solid "+(n.read?"#0f1929":"#1e3a5f") }}>
                    <div style={{ fontSize:12,color:n.read?"#475569":"#94a3b8",lineHeight:1.5 }}>{n.message}</div>
                    <div className="mono" style={{ fontSize:10,color:"#1e3a5f",marginTop:4 }}>{n.time}</div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
        <div className="mono" style={{ fontSize:11,color:"#1e3a5f" }}>{new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────────── */
function Dashboard({ user, entries }) {
  const mine = user.role==="student" ? entries.filter(e=>e.studentId===user.id) : user.role==="faculty" ? entries.filter(e=>e.branch===user.branch) : entries;
  const approved = mine.filter(e=>e.status==="approved").length;
  const flagged  = mine.filter(e=>e.status==="flagged").length;
  const pending  = mine.filter(e=>e.status==="pending").length;
  const intl     = mine.filter(e=>e.level==="International").length;

  const byCat = {};
  mine.forEach(e=>{ byCat[e.category]=(byCat[e.category]||0)+1; });

  return (
    <div>
      <h2 className="syne" style={{ fontSize:20,fontWeight:800,color:"#f1f5f9",marginBottom:4 }}>Dashboard</h2>
      <p className="sans" style={{ color:"#334155",fontSize:13,marginBottom:24 }}>
        {user.role==="student" ? "Your achievement summary at a glance" : user.role==="faculty" ? `${user.branch} department overview` : "Institution-wide NBA Criterion 4 overview"}
      </p>

      <div className="kpi-grid" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24 }}>
        {[
          { label:"Total Entries",     val:mine.length, color:"#38bdf8",  icon:"📊" },
          { label:"Approved",          val:approved,    color:"#10b981",  icon:"✅" },
          { label:"Flagged / Pending", val:flagged+pending, color:"#f59e0b", icon:"⚠️" },
          { label:"International",     val:intl,        color:"#818cf8",  icon:"🌍" },
        ].map((k,i)=>(
          <div key={i} className="kpi" style={{ borderColor:k.color+"22" }}>
            <div style={{ fontSize:24,marginBottom:8 }}>{k.icon}</div>
            <div className="syne" style={{ fontSize:34,fontWeight:800,color:k.color,lineHeight:1 }}>{k.val}</div>
            <div style={{ fontSize:12,color:"#334155",marginTop:4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="two-col" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20 }}>
        <div className="card">
          <h3 className="mono" style={{ fontSize:11,color:"#334155",letterSpacing:".1em",textTransform:"uppercase",marginBottom:18 }}>Activity Breakdown</h3>
          {Object.entries(byCat).map(([cat,cnt])=>(
            <div key={cat} style={{ marginBottom:14 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                <span style={{ fontSize:13,color:"#94a3b8" }}>{catIcons[cat]} {cat}</span>
                <span className="mono" style={{ color:catColors[cat]||"#38bdf8",fontSize:12,fontWeight:700 }}>{cnt}</span>
              </div>
              <div className="ai-bar-wrap">
                <div className="ai-bar" style={{ width:`${(cnt/Math.max(mine.length,1))*100}%`,background:catColors[cat]||"#38bdf8" }} />
              </div>
            </div>
          ))}
          {Object.keys(byCat).length===0 && <div style={{ color:"#1e3a5f",fontSize:13,textAlign:"center",padding:20 }}>No data yet</div>}
        </div>

        <div className="card">
          <h3 className="mono" style={{ fontSize:11,color:"#334155",letterSpacing:".1em",textTransform:"uppercase",marginBottom:18 }}>
            {user.role==="student" ? "Recent Submissions" : "Recently Flagged Entries"}
          </h3>
          {(user.role==="student" ? mine.slice(-4).reverse() : mine.filter(e=>e.status==="flagged").slice(0,4)).map(e=>(
            <div key={e.id} style={{ display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:"1px solid #0f1929" }}>
              <div style={{ fontSize:20 }}>{catIcons[e.category]||"📌"}</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:13,color:"#e2e8f0",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.title}</div>
                <div className="mono" style={{ fontSize:10,color:"#334155",marginTop:2 }}>{e.category} · {e.date}</div>
              </div>
              <StatusBadge status={e.status} score={e.aiScore} />
            </div>
          ))}
          {mine.length===0 && <div style={{ color:"#1e3a5f",fontSize:13,textAlign:"center",padding:20 }}>Nothing to show yet</div>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   STATUS BADGE + SCORE RING
───────────────────────────────────────────── */
function StatusBadge({ status, score }) {
  const cfg = {
    approved:{ bg:"#05280f",color:"#4ade80",text:"Approved" },
    flagged: { bg:"#2d1a00",color:"#f59e0b",text:"Flagged"  },
    pending: { bg:"#0c1a2e",color:"#38bdf8",text:"Pending"  },
    rejected:{ bg:"#1c0a0a",color:"#f87171",text:"Rejected" },
  };
  const c = cfg[status] || cfg.pending;
  return <span className="badge" style={{ background:c.bg,color:c.color }}><span style={{ width:5,height:5,borderRadius:"50%",background:c.color,display:"inline-block" }}/>{c.text}</span>;
}

function AIScoreRing({ score }) {
  const color = score>=80?"#10b981":score>=50?"#f59e0b":"#ef4444";
  return (
    <div className="score-ring" style={{ background:`conic-gradient(${color} ${score}%, #0f1929 0%)`,color }}>
      <div style={{ width:42,height:42,borderRadius:"50%",background:"#0a1120",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700 }}>{score}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SUBMIT ACHIEVEMENT (Student)
───────────────────────────────────────────── */
function SubmitAchievement({ user, entries, setEntries, setNotifs }) {
  const blank = { category:"Hackathon",title:"",organizer:"",date:"",position:"",level:"National",year:user.year,hasCertificate:false,qrScanned:false,certUrl:"",linkUrl:"" };
  const [form, setForm] = useState(blank);
  const [step, setStep] = useState(1); // 1=form 2=ai-result
  const [aiResult, setAIResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const F = (k,v) => setForm(p=>({...p,[k]:v}));

  const runValidation = () => {
    setLoading(true);
    setTimeout(()=>{
      const result = runAIValidation(form, entries, user.id);
      setAIResult(result);
      setLoading(false);
      setStep(2);
    }, 1800);
  };

  const simulateQR = () => {
    setQrLoading(true);
    setTimeout(()=>{ F("qrScanned",true); setQrLoading(false); }, 1500);
  };

  const finalSubmit = () => {
    const newEntry = {
      id: "e"+Date.now(), studentId:user.id, studentName:user.name, rollNo:user.rollNo,
      branch:user.branch, year:user.year, ...form,
      status:aiResult.status, aiScore:aiResult.score, aiFlags:aiResult.flags,
      addedBy:"student", submittedAt:new Date().toISOString().slice(0,10), mentorNote:""
    };
    setEntries(p=>[...p,newEntry]);
    // Notify faculty
    const notifId = "n"+Date.now();
    if (aiResult.status==="flagged") {
      setNotifs(p=>[...p,{
        id:notifId, to:"f1", from:"system",
        message:`🚩 Flagged entry needs review: "${form.title}" by ${user.name}`,
        read:false, time:new Date().toISOString().slice(0,10), entryId:newEntry.id
      },{
        id:notifId+"h", to:"d1", from:"system",
        message:`New flagged entry in ${user.branch}: "${form.title}"`,
        read:false, time:new Date().toISOString().slice(0,10), entryId:newEntry.id
      }]);
    }
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{ textAlign:"center",padding:"60px 0" }}>
      <div style={{ fontSize:56,marginBottom:16 }}>{aiResult?.status==="approved"?"🎉":"⚠️"}</div>
      <h2 className="syne" style={{ fontSize:22,fontWeight:800,color:"#f1f5f9",marginBottom:8 }}>
        {aiResult?.status==="approved" ? "Achievement Submitted!" : "Submitted for Review"}
      </h2>
      <p style={{ color:"#64748b",fontSize:14,maxWidth:400,margin:"0 auto 24px" }}>
        {aiResult?.status==="approved" ? "Your achievement has been automatically verified and approved." : "Your submission has been flagged for manual review by faculty. You'll be notified of the outcome."}
      </p>
      <button className="btn btn-blue" onClick={()=>{setStep(1);setForm(blank);setAIResult(null);setSubmitted(false);}}>Submit Another</button>
    </div>
  );

  return (
    <div style={{ maxWidth:680 }}>
      <h2 className="syne" style={{ fontSize:20,fontWeight:800,color:"#f1f5f9",marginBottom:4 }}>Submit Achievement</h2>
      <p style={{ color:"#334155",fontSize:13,marginBottom:24 }}>AI will validate your entry before it appears in records</p>

      {step===1 && (
        <div className="card fu">
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16 }}>
            <div>
              <div className="lbl">Category *</div>
              <select className="inp" value={form.category} onChange={e=>F("category",e.target.value)}>
                {CATEGORIES.filter(c=>c!=="Research Mentorship").map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div className="lbl">Level *</div>
              <select className="inp" value={form.level} onChange={e=>F("level",e.target.value)}>
                {LEVELS.map(l=><option key={l}>{l}</option>)}
              </select>
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <div className="lbl">Activity / Achievement Title *</div>
              <input className="inp" placeholder="e.g. Smart India Hackathon 2024" value={form.title} onChange={e=>F("title",e.target.value)} />
            </div>
            <div>
              <div className="lbl">Organizer / Institution *</div>
              <input className="inp" placeholder="e.g. IEEE, NPTEL, Google" value={form.organizer} onChange={e=>F("organizer",e.target.value)} />
            </div>
            <div>
              <div className="lbl">Date *</div>
              <input className="inp" type="date" value={form.date} onChange={e=>F("date",e.target.value)} />
            </div>
            <div>
              <div className="lbl">Position / Outcome</div>
              <input className="inp" placeholder="Winner, Certified, Participated…" value={form.position} onChange={e=>F("position",e.target.value)} />
            </div>
            <div>
              <div className="lbl">External Link (optional)</div>
              <input className="inp" placeholder="https://certificate-link.com" value={form.linkUrl} onChange={e=>F("linkUrl",e.target.value)} />
            </div>
          </div>

          {/* Certificate section */}
          <div style={{ background:"#080d1a",border:"1px solid #0f1929",borderRadius:10,padding:18,marginBottom:20 }}>
            <div className="lbl" style={{ marginBottom:12 }}>Certificate</div>
            <div style={{ display:"flex",gap:12,alignItems:"flex-start",flexWrap:"wrap" }}>
              <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"#94a3b8" }}>
                <input type="checkbox" checked={form.hasCertificate} onChange={e=>F("hasCertificate",e.target.checked)} style={{ width:16,height:16 }} />
                I have a certificate
              </label>
              {form.hasCertificate && (
                <div className="qr-box" style={{ flex:1,minWidth:200 }} onClick={simulateQR}>
                  {qrLoading ? <div className="spin" style={{ fontSize:24,display:"inline-block" }}>↻</div>
                  : form.qrScanned
                  ? <div style={{ color:"#10b981",fontSize:13 }}>✓ QR Verified</div>
                  : <div style={{ color:"#334155",fontSize:12 }}>📷 Click to scan certificate QR<br/><span style={{ fontSize:11,color:"#1e3a5f" }}>(Simulates QR verification)</span></div>}
                </div>
              )}
            </div>
            {!form.hasCertificate && <div style={{ marginTop:10,fontSize:12,color:"#475569" }}>⚠ Entries without certificates are flagged for manual review</div>}
          </div>

          <button className="btn btn-blue" style={{ width:"100%" }} onClick={runValidation} disabled={!form.title||!form.organizer||!form.date}>
            {(!form.title||!form.organizer||!form.date) ? "Fill required fields" : "Submit & Validate with AI →"}
          </button>
        </div>
      )}

      {step===2 && aiResult && (
        <div className="fu">
          {/* AI Result Card */}
          <div className="card" style={{ marginBottom:16,borderColor:aiResult.status==="approved"?"#10b98133":"#f59e0b33" }}>
            <div style={{ display:"flex",gap:16,alignItems:"flex-start",marginBottom:20 }}>
              <AIScoreRing score={aiResult.score} />
              <div>
                <div className="syne" style={{ fontSize:16,fontWeight:700,color:"#f1f5f9",marginBottom:4 }}>
                  AI Validation — {aiResult.status==="approved"?"Passed ✅":"Flagged for Review ⚠️"}
                </div>
                <div style={{ fontSize:13,color:"#64748b" }}>
                  {aiResult.status==="approved"
                    ? "All checks passed. This entry will be directly approved."
                    : "Some issues detected. Entry will be visible but marked for faculty review."}
                </div>
              </div>
            </div>

            {aiResult.flags.length > 0 && (
              <div style={{ marginBottom:12 }}>
                <div className="lbl" style={{ marginBottom:8 }}>Issues Found</div>
                {aiResult.flags.map((f,i)=>(
                  <div key={i} className="flag-item"><span>⚠</span><span>{f}</span></div>
                ))}
                <div style={{ fontSize:12,color:"#475569",marginTop:10,padding:"8px 12px",background:"#0a1120",borderRadius:8 }}>
                  ℹ️ Your entry will still be submitted and visible. Faculty will review and approve or reject it.
                </div>
              </div>
            )}

            {/* Entry summary */}
            <div style={{ background:"#080d1a",borderRadius:10,padding:14,fontSize:13,color:"#64748b" }}>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                {[["Title",form.title],["Category",form.category],["Organizer",form.organizer],["Date",form.date],["Level",form.level],["Certificate",form.hasCertificate?(form.qrScanned?"Yes (QR Verified)":"Yes (Unverified)"):"No"]].map(([k,v])=>(
                  <div key={k}><span style={{ color:"#334155" }}>{k}: </span><span style={{ color:"#94a3b8" }}>{v}</span></div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display:"flex",gap:12 }}>
            <button className="btn btn-ghost" onClick={()=>setStep(1)}>← Edit Entry</button>
            <button className="btn btn-blue" style={{ flex:1 }} onClick={finalSubmit} disabled={loading}>
              {loading ? <span className="pulse">Validating…</span> : "Confirm & Submit"}
            </button>
          </div>
        </div>
      )}

      {loading && step===1 && (
        <div style={{ textAlign:"center",padding:40 }}>
          <div className="spin" style={{ fontSize:32,display:"inline-block",color:"#38bdf8" }}>↻</div>
          <div style={{ color:"#334155",fontSize:13,marginTop:12 }}>AI is validating your submission…</div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   MY RECORDS (Student)
───────────────────────────────────────────── */
function MyRecords({ user, entries, setEntries }) {
  const mine = entries.filter(e=>e.studentId===user.id);
  const [editing, setEditing] = useState(null);

  return (
    <div>
      <h2 className="syne" style={{ fontSize:20,fontWeight:800,color:"#f1f5f9",marginBottom:4 }}>My Achievements</h2>
      <p style={{ color:"#334155",fontSize:13,marginBottom:24 }}>{mine.length} total · {mine.filter(e=>e.status==="approved").length} approved · {mine.filter(e=>e.status==="flagged").length} flagged</p>

      {mine.length===0 && <div className="card" style={{ textAlign:"center",padding:48,color:"#334155" }}>You haven't submitted anything yet.</div>}

      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        {mine.map(e=>(
          <div key={e.id} className="card" style={{ borderColor:e.status==="flagged"?"#f59e0b22":e.status==="approved"?"#10b98122":"#0f1929" }}>
            <div style={{ display:"flex",gap:14,alignItems:"flex-start" }}>
              <AIScoreRing score={e.aiScore} />
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8 }}>
                  <div>
                    <div style={{ fontSize:15,fontWeight:600,color:"#e2e8f0",marginBottom:2 }}>{e.title}</div>
                    <div className="mono" style={{ fontSize:11,color:"#334155" }}>{e.category} · {e.organizer} · {e.date} · {e.level}</div>
                  </div>
                  <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                    <StatusBadge status={e.status} />
                    {e.status==="pending" && <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(e)}>Edit</button>}
                  </div>
                </div>
                {e.aiFlags.length > 0 && (
                  <div style={{ marginTop:12 }}>
                    <div className="lbl" style={{ marginBottom:6,color:"#92400e" }}>AI Flags (why it was flagged)</div>
                    {e.aiFlags.map((f,i)=><div key={i} style={{ fontSize:12,color:"#f59e0b",marginBottom:4 }}>⚠ {f}</div>)}
                  </div>
                )}
                {e.mentorNote && <div style={{ marginTop:8,fontSize:12,color:"#38bdf8" }}>🔗 Mentor link: <a href={e.mentorNote} style={{ color:"#38bdf8" }} target="_blank" rel="noreferrer">{e.mentorNote}</a></div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   REVIEW QUEUE (Faculty / HOD)
───────────────────────────────────────────── */
function ReviewQueue({ user, entries, setEntries }) {
  const queue = entries.filter(e=>e.status==="flagged" && (user.role==="hod" || e.branch===user.branch));
  const [note, setNote] = useState({});

  const decide = (id, decision) => {
    setEntries(p=>p.map(e=>e.id===id ? {...e,status:decision,reviewNote:note[id]||""} : e));
  };

  return (
    <div>
      <h2 className="syne" style={{ fontSize:20,fontWeight:800,color:"#f1f5f9",marginBottom:4 }}>Review Queue</h2>
      <p style={{ color:"#334155",fontSize:13,marginBottom:24 }}>{queue.length} entries awaiting manual review</p>

      {queue.length===0 && <div className="card" style={{ textAlign:"center",padding:48 }}><div style={{ fontSize:48,marginBottom:12 }}>✅</div><div style={{ color:"#10b981",fontSize:15 }}>All clear — no entries pending review</div></div>}

      <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
        {queue.map(e=>(
          <div key={e.id} className="card" style={{ borderColor:"#f59e0b33" }}>
            <div style={{ display:"flex",gap:14,alignItems:"flex-start" }}>
              <AIScoreRing score={e.aiScore} />
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:15,fontWeight:600,color:"#e2e8f0",marginBottom:3 }}>{e.title}</div>
                    <div className="mono" style={{ fontSize:11,color:"#334155" }}>
                      {e.studentName} · {e.rollNo} · {e.category} · {e.organizer} · {e.date}
                    </div>
                  </div>
                  <span className="badge" style={{ background:"#1c0a0a",color:"#f59e0b" }}>Needs Review</span>
                </div>

                {/* AI Flags */}
                <div style={{ marginBottom:14 }}>
                  <div className="lbl" style={{ marginBottom:6,color:"#92400e" }}>AI Flagged Because:</div>
                  {e.aiFlags.map((f,i)=><div key={i} className="flag-item"><span style={{ flexShrink:0 }}>⚠</span><span>{f}</span></div>)}
                </div>

                {/* Certificate & link info */}
                <div style={{ display:"flex",gap:10,marginBottom:14,flexWrap:"wrap" }}>
                  <span className="badge" style={{ background:e.hasCertificate?"#052e16":"#1c0a0a",color:e.hasCertificate?"#4ade80":"#f87171" }}>{e.hasCertificate?"📎 Certificate Attached":"❌ No Certificate"}</span>
                  <span className="badge" style={{ background:e.qrScanned?"#052e16":"#1c0a0a",color:e.qrScanned?"#4ade80":"#f87171" }}>{e.qrScanned?"✓ QR Verified":"✗ QR Not Scanned"}</span>
                  <span className="badge" style={{ background:"#0c1a2e",color:"#38bdf8" }}>{e.level}</span>
                </div>

                {/* Review note */}
                <div style={{ marginBottom:12 }}>
                  <div className="lbl" style={{ marginBottom:5 }}>Faculty Review Note (optional)</div>
                  <input className="inp" placeholder="Add note before approving or rejecting…" value={note[e.id]||""} onChange={ev=>setNote(p=>({...p,[e.id]:ev.target.value}))} />
                </div>

                <div style={{ display:"flex",gap:10 }}>
                  <button className="btn btn-green" onClick={()=>decide(e.id,"approved")}>✓ Approve</button>
                  <button className="btn btn-red" onClick={()=>decide(e.id,"rejected")}>✗ Reject</button>
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft:"auto" }}>View Certificate</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ALL RECORDS (Faculty / HOD)
───────────────────────────────────────────── */
function AllRecords({ user, entries }) {
  const [filters, setFilters] = useState({ cat:"All",status:"All",branch:"All",level:"All",search:"" });
  const F = (k,v) => setFilters(p=>({...p,[k]:v}));
  const [activeTab, setActiveTab] = useState("student");

  const base = user.role==="hod" ? entries : entries.filter(e=>e.branch===user.branch);

  const filtered = useMemo(()=>base.filter(e=>{
    if (filters.cat!=="All" && e.category!==filters.cat) return false;
    if (filters.status!=="All" && e.status!==filters.status) return false;
    if (filters.branch!=="All" && e.branch!==filters.branch) return false;
    if (filters.level!=="All" && e.level!==filters.level) return false;
    if (filters.search && ![e.studentName,e.rollNo,e.title,e.organizer].some(v=>(v||"").toLowerCase().includes(filters.search.toLowerCase()))) return false;
    return true;
  }),[base,filters]);

  const byStudent = useMemo(()=>{
    const map = {};
    filtered.forEach(e=>{
      if (!map[e.studentId]) map[e.studentId]={ name:e.studentName,rollNo:e.rollNo,branch:e.branch,entries:[] };
      map[e.studentId].entries.push(e);
    });
    return Object.values(map);
  },[filtered]);

  const byEvent = useMemo(()=>{
    const map = {};
    filtered.forEach(e=>{
      const key=e.title;
      if (!map[key]) map[key]={ title:e.title,category:e.category,level:e.level,entries:[] };
      map[key].entries.push(e);
    });
    return Object.values(map);
  },[filtered]);

  return (
    <div>
      <h2 className="syne" style={{ fontSize:20,fontWeight:800,color:"#f1f5f9",marginBottom:4 }}>All Records</h2>

      {/* Filters */}
      <div style={{ display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center" }}>
        <input className="inp" style={{ width:200 }} placeholder="🔍 Search…" value={filters.search} onChange={e=>F("search",e.target.value)} />
        {[["cat",["All",...CATEGORIES]],["status",["All","approved","flagged","pending","rejected"]],["level",["All",...LEVELS]],...(user.role==="hod"?[["branch",["All",...BRANCHES]]]:[])]
          .map(([k,opts])=>(
            <select key={k} className="inp" style={{ width:130 }} value={filters[k]} onChange={e=>F(k,e.target.value)}>
              {opts.map(o=><option key={o}>{o}</option>)}
            </select>
          ))}
        <span className="mono" style={{ fontSize:11,color:"#334155",marginLeft:"auto" }}>{filtered.length} records</span>
      </div>

      {/* View tabs */}
      <div style={{ display:"flex",gap:0,borderBottom:"1px solid #0f1929",marginBottom:20 }}>
        {[["all","All Entries"],["student","By Student"],["event","By Event"]].map(([k,l])=>(
          <button key={k} className={`tab ${activeTab===k?"active":""}`} onClick={()=>setActiveTab(k)}>{l}</button>
        ))}
      </div>

      {activeTab==="all" && (
        <div className="card" style={{ padding:0,overflow:"hidden" }}>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Roll No</th><th>Name</th><th>Branch</th><th>Category</th><th>Title</th><th>Organizer</th><th>Date</th><th>Level</th><th>AI Score</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.map(e=>(
                  <tr key={e.id}>
                    <td className="mono" style={{ fontSize:11,color:"#334155" }}>{e.rollNo}</td>
                    <td style={{ color:"#e2e8f0",fontWeight:500 }}>{e.studentName}</td>
                    <td><span className="badge" style={{ background:"#0f1929",color:"#64748b" }}>{e.branch}</span></td>
                    <td><span className="badge" style={{ background:(catColors[e.category]||"#38bdf8")+"22",color:catColors[e.category]||"#38bdf8" }}>{catIcons[e.category]} {e.category}</span></td>
                    <td style={{ color:"#cbd5e1",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.title}</td>
                    <td style={{ color:"#475569" }}>{e.organizer}</td>
                    <td className="mono" style={{ fontSize:11,color:"#334155" }}>{e.date}</td>
                    <td style={{ color:"#64748b",fontSize:12 }}>{e.level}</td>
                    <td><div style={{ display:"flex",alignItems:"center",gap:6 }}><div style={{ width:28,height:28,borderRadius:"50%",background:`conic-gradient(${e.aiScore>=80?"#10b981":e.aiScore>=50?"#f59e0b":"#ef4444"} ${e.aiScore}%,#0f1929 0%)`,display:"flex",alignItems:"center",justifyContent:"center" }}><div style={{ width:20,height:20,borderRadius:"50%",background:"#0a1120",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#94a3b8" }}>{e.aiScore}</div></div></div></td>
                    <td><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab==="student" && (
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {byStudent.map((s,i)=>(
            <div key={i} className="card">
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                <div style={{ display:"flex",gap:12,alignItems:"center" }}>
                  <div style={{ width:36,height:36,borderRadius:8,background:"#0f1929",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#38bdf8",fontFamily:"'DM Mono',monospace" }}>{(s.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
                  <div>
                    <div style={{ fontWeight:600,color:"#e2e8f0",fontSize:14 }}>{s.name}</div>
                    <div className="mono" style={{ fontSize:11,color:"#334155" }}>{s.rollNo} · {s.branch}</div>
                  </div>
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <span className="badge" style={{ background:"#0c1a2e",color:"#38bdf8" }}>{s.entries.length} achievements</span>
                  <span className="badge" style={{ background:"#052e16",color:"#4ade80" }}>{s.entries.filter(e=>e.status==="approved").length} approved</span>
                </div>
              </div>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                {s.entries.map(e=><span key={e.id} className="badge" style={{ background:(catColors[e.category]||"#38bdf8")+"22",color:catColors[e.category]||"#38bdf8" }}>{catIcons[e.category]} {e.category}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab==="event" && (
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {byEvent.map((ev,i)=>(
            <div key={i} className="card">
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                <div>
                  <div style={{ fontWeight:600,color:"#e2e8f0",fontSize:14 }}>{ev.title}</div>
                  <div className="mono" style={{ fontSize:11,color:"#334155" }}>{ev.category} · {ev.level}</div>
                </div>
                <span className="badge" style={{ background:"#0c1a2e",color:"#38bdf8" }}>{ev.entries.length} participant{ev.entries.length!==1?"s":""}</span>
              </div>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                {ev.entries.map(e=>(
                  <span key={e.id} className="badge" style={{ background:"#0f1929",color:"#94a3b8" }}>{e.studentName}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   FACULTY ADD ENTRY
───────────────────────────────────────────── */
function FacultyAddEntry({ user, entries, setEntries }) {
  const [form, setForm] = useState({ category:"Workshop",title:"",organizer:"",date:"",position:"",level:"National",branch:user.role==="hod"?"CSE":user.branch,year:"Faculty",hasCertificate:true,qrScanned:false,linkUrl:"",certUrl:"",notes:"" });
  const [done, setDone] = useState(false);
  const F=(k,v)=>setForm(p=>({...p,[k]:v}));

  const submit = () => {
    const newEntry = {
      id:"e"+Date.now(), studentId:user.id, studentName:user.name, rollNo:"—",
      ...form, aiScore:100, aiFlags:[], status:"approved",
      addedBy:user.role, submittedAt:new Date().toISOString().slice(0,10), mentorNote:""
    };
    setEntries(p=>[...p,newEntry]);
    setDone(true);
  };

  if (done) return (
    <div style={{ textAlign:"center",padding:60 }}>
      <div style={{ fontSize:48,marginBottom:12 }}>✅</div>
      <h2 className="syne" style={{ fontSize:20,fontWeight:800,color:"#f1f5f9",marginBottom:8 }}>Entry Added</h2>
      <p style={{ color:"#64748b",marginBottom:24 }}>It's now visible in all records and NBA reports.</p>
      <button className="btn btn-blue" onClick={()=>{setDone(false);setForm({...form,title:"",organizer:"",notes:""})}}>Add Another</button>
    </div>
  );

  return (
    <div style={{ maxWidth:680 }}>
      <h2 className="syne" style={{ fontSize:20,fontWeight:800,color:"#f1f5f9",marginBottom:4 }}>
        {user.role==="hod" ? "Add Department Event / Achievement" : "Add Event, Workshop or Research Activity"}
      </h2>
      <p style={{ color:"#334155",fontSize:13,marginBottom:24 }}>Entries added by {user.role==="hod"?"department admins":"faculty"} are auto-approved</p>

      <div className="card">
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
          <div>
            <div className="lbl">Category</div>
            <select className="inp" value={form.category} onChange={e=>F("category",e.target.value)}>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          {user.role==="hod" && <div>
            <div className="lbl">Department</div>
            <select className="inp" value={form.branch} onChange={e=>F("branch",e.target.value)}>
              {BRANCHES.map(b=><option key={b}>{b}</option>)}
            </select>
          </div>}
          <div style={{ gridColumn:user.role==="hod"?"unset":"1/-1" }}>
            <div className="lbl">Level</div>
            <select className="inp" value={form.level} onChange={e=>F("level",e.target.value)}>
              {LEVELS.map(l=><option key={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <div className="lbl">Title / Activity Name *</div>
            <input className="inp" placeholder="e.g. Guest Lecture on Cloud Computing" value={form.title} onChange={e=>F("title",e.target.value)} />
          </div>
          <div>
            <div className="lbl">Organizer</div>
            <input className="inp" placeholder="IEEE, Dept of CSE, etc." value={form.organizer} onChange={e=>F("organizer",e.target.value)} />
          </div>
          <div>
            <div className="lbl">Date</div>
            <input className="inp" type="date" value={form.date} onChange={e=>F("date",e.target.value)} />
          </div>
          <div>
            <div className="lbl">Position / Outcome</div>
            <input className="inp" placeholder="Organized, Conducted, Published…" value={form.position} onChange={e=>F("position",e.target.value)} />
          </div>
          <div>
            <div className="lbl">Reference / External Link</div>
            <input className="inp" placeholder="https://event-link.com" value={form.linkUrl} onChange={e=>F("linkUrl",e.target.value)} />
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <div className="lbl">Notes (for NBA documentation)</div>
            <textarea className="inp" rows={3} placeholder="Additional context, participants, impact…" value={form.notes} onChange={e=>F("notes",e.target.value)} style={{ resize:"vertical" }} />
          </div>
        </div>
        <button className="btn btn-blue" style={{ width:"100%",marginTop:4 }} onClick={submit} disabled={!form.title}>Add Entry →</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MENTORSHIP LOG (Faculty)
───────────────────────────────────────────── */
function MentorshipLog({ user, entries, setEntries }) {
  const mine = entries.filter(e=>e.addedBy==="faculty" && e.studentId===user.id && e.category==="Research Mentorship");
  const [form, setForm] = useState({ title:"",mentees:"",link:"",date:"",notes:"" });
  const [added, setAdded] = useState(false);
  const F=(k,v)=>setForm(p=>({...p,[k]:v}));

  const submit=()=>{
    const entry={
      id:"e"+Date.now(), studentId:user.id, studentName:user.name, rollNo:"—",
      branch:user.branch, year:"Faculty", category:"Research Mentorship",
      title:form.title, organizer:user.branch+" Dept", date:form.date,
      position:"Mentor", level:"Institutional", hasCertificate:false, qrScanned:false,
      status:"approved", aiScore:100, aiFlags:[], addedBy:"faculty",
      submittedAt:new Date().toISOString().slice(0,10),
      mentorNote:form.link,
      mentees:form.mentees.split(",").map(s=>s.trim()),
      notes:form.notes
    };
    setEntries(p=>[...p,entry]);
    setAdded(true);
    setForm({ title:"",mentees:"",link:"",date:"",notes:"" });
  };

  return (
    <div style={{ maxWidth:680 }}>
      <h2 className="syne" style={{ fontSize:20,fontWeight:800,color:"#f1f5f9",marginBottom:4 }}>Mentorship Log</h2>
      <p style={{ color:"#334155",fontSize:13,marginBottom:24 }}>Log research groups, projects, or activities you mentored — counted toward NBA Criterion 4</p>

      {added && <div style={{ background:"#052e16",border:"1px solid #10b98133",borderRadius:10,padding:"12px 16px",marginBottom:16,color:"#4ade80",fontSize:13 }}>✓ Mentorship entry added successfully</div>}

      <div className="card" style={{ marginBottom:24 }}>
        <h3 className="mono" style={{ fontSize:11,color:"#334155",letterSpacing:".1em",textTransform:"uppercase",marginBottom:16 }}>Add New Mentorship Entry</h3>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <div className="lbl">Research / Project Title *</div>
            <input className="inp" placeholder="e.g. Deep Learning Research Group — Semester 5" value={form.title} onChange={e=>F("title",e.target.value)} />
          </div>
          <div>
            <div className="lbl">Date Started</div>
            <input className="inp" type="date" value={form.date} onChange={e=>F("date",e.target.value)} />
          </div>
          <div>
            <div className="lbl">Project / Research Link</div>
            <input className="inp" placeholder="https://github.com/lab/project or doi link" value={form.link} onChange={e=>F("link",e.target.value)} />
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <div className="lbl">Mentee Names (comma separated)</div>
            <input className="inp" placeholder="Arjun Sharma, Priya Nair, Rahul Verma…" value={form.mentees} onChange={e=>F("mentees",e.target.value)} />
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <div className="lbl">Description / Outcome for NBA</div>
            <textarea className="inp" rows={3} placeholder="Brief description of the project, outcomes, publications if any…" value={form.notes} onChange={e=>F("notes",e.target.value)} style={{ resize:"vertical" }} />
          </div>
        </div>
        <button className="btn btn-blue" style={{ marginTop:4,width:"100%" }} onClick={submit} disabled={!form.title}>Log Mentorship →</button>
      </div>

      <h3 className="mono" style={{ fontSize:11,color:"#334155",letterSpacing:".1em",textTransform:"uppercase",marginBottom:14 }}>My Mentorship Entries ({mine.length})</h3>
      {mine.length===0 && <div className="card" style={{ textAlign:"center",color:"#334155",padding:32 }}>No mentorship entries yet</div>}
      {mine.map(e=>(
        <div key={e.id} className="card" style={{ marginBottom:12 }}>
          <div style={{ fontWeight:600,color:"#e2e8f0",fontSize:14,marginBottom:4 }}>🔬 {e.title}</div>
          <div className="mono" style={{ fontSize:11,color:"#334155",marginBottom:10 }}>{e.date} · {e.level}</div>
          {e.mentees?.length>0 && <div style={{ marginBottom:8 }}>
            <span style={{ fontSize:12,color:"#64748b" }}>Mentees: </span>
            {e.mentees.map((m,i)=><span key={i} className="badge" style={{ background:"#0f1929",color:"#94a3b8",marginRight:4 }}>{m}</span>)}
          </div>}
          {e.mentorNote && <div style={{ fontSize:12,color:"#38bdf8" }}>🔗 <a href={e.mentorNote} style={{ color:"#38bdf8" }} target="_blank" rel="noreferrer">{e.mentorNote}</a></div>}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   NBA REPORT
───────────────────────────────────────────── */
function NBAReport({ user, entries }) {
  const base = user.role==="hod" ? entries : entries.filter(e=>e.branch===user.branch);
  const approved = base.filter(e=>e.status==="approved");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const byCat = {};
  approved.forEach(e=>{ byCat[e.category]=(byCat[e.category]||0)+1; });

  const generate=()=>{ setGenerating(true); setTimeout(()=>{ setGenerating(false); setGenerated(true); },2000); };

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24 }}>
        <div>
          <h2 className="syne" style={{ fontSize:20,fontWeight:800,color:"#f1f5f9",marginBottom:4 }}>NBA Criterion 4 Report</h2>
          <p style={{ color:"#334155",fontSize:13 }}>Auto-generated from approved entries only · {approved.length} records included</p>
        </div>
        <button className="btn btn-blue" onClick={generate} disabled={generating}>
          {generating ? <span className="pulse">⟳ Generating…</span> : generated ? "⬇ Export PDF" : "Generate Report"}
        </button>
      </div>

      {/* Compliance */}
      <div className="card" style={{ marginBottom:20 }}>
        <h3 className="mono" style={{ fontSize:11,color:"#334155",letterSpacing:".1em",textTransform:"uppercase",marginBottom:18 }}>Criterion 4 Compliance Scorecard</h3>
        {[
          { label:"Professional Society / Workshop Activities", target:5, actual:(byCat["Workshop"]||0)+(byCat["Conference"]||0) },
          { label:"Hackathons & Competitive Events", target:5, actual:(byCat["Hackathon"]||0)+(byCat["Competition"]||0) },
          { label:"Industry Certifications", target:3, actual:byCat["Certification"]||0 },
          { label:"Internships", target:4, actual:byCat["Internship"]||0 },
          { label:"Research Papers / Conference Presentations", target:2, actual:byCat["Conference"]||0 },
          { label:"Mentorship / Research Group Activities", target:2, actual:byCat["Research Mentorship"]||0 },
        ].map((item,i)=>{
          const pct=Math.min(100,(item.actual/item.target)*100);
          const ok=item.actual>=item.target;
          return (
            <div key={i} style={{ marginBottom:16 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                <span style={{ fontSize:13,color:"#94a3b8" }}>{item.label}</span>
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  <span className="mono" style={{ fontSize:11,color:"#475569" }}>{item.actual}/{item.target}</span>
                  <span>{ok?"✅":"⚠️"}</span>
                </div>
              </div>
              <div className="ai-bar-wrap">
                <div className="ai-bar" style={{ width:`${pct}%`,background:ok?"#10b981":"#f59e0b" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Report sections */}
      {CATEGORIES.map(cat=>{
        const catEntries = approved.filter(e=>e.category===cat);
        if(!catEntries.length) return null;
        return (
          <div key={cat} className="card" style={{ marginBottom:16 }}>
            <h3 style={{ fontSize:14,fontWeight:600,color:catColors[cat]||"#38bdf8",marginBottom:16 }}>{catIcons[cat]} {cat} — {catEntries.length} entries</h3>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>#</th><th>Student / Faculty</th><th>Roll No</th><th>Title</th><th>Organizer</th><th>Date</th><th>Level</th><th>Outcome</th></tr></thead>
                <tbody>
                  {catEntries.map((e,i)=>(
                    <tr key={e.id}>
                      <td className="mono" style={{ color:"#334155",fontSize:11 }}>{i+1}</td>
                      <td style={{ color:"#e2e8f0",fontWeight:500 }}>{e.studentName}</td>
                      <td className="mono" style={{ color:"#334155",fontSize:11 }}>{e.rollNo}</td>
                      <td style={{ color:"#cbd5e1",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.title}</td>
                      <td style={{ color:"#475569",fontSize:12 }}>{e.organizer}</td>
                      <td className="mono" style={{ color:"#334155",fontSize:11 }}>{e.date}</td>
                      <td><span className="badge" style={{ background:"#0c1a2e",color:"#38bdf8",fontSize:10 }}>{e.level}</span></td>
                      <td style={{ color:"#10b981",fontSize:12 }}>{e.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Summary */}
      <div className="card" style={{ borderColor:"#38bdf833" }}>
        <h3 className="mono" style={{ fontSize:11,color:"#334155",letterSpacing:".1em",textTransform:"uppercase",marginBottom:16 }}>Consolidated Summary</h3>
        <table>
          <thead><tr><th>Category</th><th>International</th><th>National</th><th>State/Industry</th><th>Total</th></tr></thead>
          <tbody>
            {CATEGORIES.map(cat=>{
              const cd=approved.filter(e=>e.category===cat);
              if(!cd.length) return null;
              return (
                <tr key={cat}>
                  <td style={{ color:"#e2e8f0",fontWeight:600 }}>{catIcons[cat]} {cat}</td>
                  <td className="mono" style={{ color:"#60a5fa" }}>{cd.filter(e=>e.level==="International").length}</td>
                  <td className="mono" style={{ color:"#4ade80" }}>{cd.filter(e=>e.level==="National").length}</td>
                  <td className="mono" style={{ color:"#a78bfa" }}>{cd.filter(e=>!["International","National"].includes(e.level)).length}</td>
                  <td className="mono" style={{ color:"#f59e0b",fontWeight:700 }}>{cd.length}</td>
                </tr>
              );
            })}
            <tr style={{ background:"#0f1929" }}>
              <td style={{ color:"#f1f5f9",fontWeight:700 }}>TOTAL</td>
              <td className="mono" style={{ color:"#60a5fa",fontWeight:700 }}>{approved.filter(e=>e.level==="International").length}</td>
              <td className="mono" style={{ color:"#4ade80",fontWeight:700 }}>{approved.filter(e=>e.level==="National").length}</td>
              <td className="mono" style={{ color:"#a78bfa",fontWeight:700 }}>{approved.filter(e=>!["International","National"].includes(e.level)).length}</td>
              <td className="mono" style={{ color:"#f59e0b",fontWeight:700,fontSize:16 }}>{approved.length}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MANAGE USERS (HOD)
───────────────────────────────────────────── */
function ManageUsers() {
  return (
    <div>
      <h2 className="syne" style={{ fontSize:20,fontWeight:800,color:"#f1f5f9",marginBottom:4 }}>Manage Users</h2>
      <p style={{ color:"#334155",fontSize:13,marginBottom:24 }}>Faculty accounts and department roles (Firebase Auth in production)</p>
      <div className="card" style={{ padding:0,overflow:"hidden" }}>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Actions</th></tr></thead>
            <tbody>
              {DEMO_USERS.map(u=>(
                <tr key={u.id}>
                  <td style={{ color:"#e2e8f0",fontWeight:500 }}>{u.name}</td>
                  <td className="mono" style={{ color:"#475569",fontSize:12 }}>{u.email}</td>
                  <td><span className="role-pill" style={{ background:u.role==="student"?"#0c1a2e":u.role==="faculty"?"#052e16":"#2d1a00",color:u.role==="student"?"#38bdf8":u.role==="faculty"?"#4ade80":"#f59e0b" }}>{u.role==="hod"?"HOD":u.role}</span></td>
                  <td style={{ color:"#64748b" }}>{u.branch||"—"}</td>
                  <td style={{ display:"flex",gap:8 }}><button className="btn btn-ghost btn-sm">Edit</button><button className="btn btn-red btn-sm">Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop:20 }}>
        <button className="btn btn-blue">+ Invite Faculty</button>
      </div>
    </div>
  );
}
