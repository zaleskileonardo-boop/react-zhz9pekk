import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend as RechartsLegend
} from 'recharts';

// --- CONFIGURAÇÃO DO SUPABASE ---
// ⚠️ SUBSTITUA PELAS SUAS CHAVES AQUI
const SUPABASE_URL = "https://ukavquivadvysccqzijc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrYXZxdWl2YWR2eXNjY3F6aWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MjUxNTUsImV4cCI6MjA4MDQwMTE1NX0.Kge7AVBv_HXh4FyDf6BcmxnSd7uSc02pZi27zr5cos4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DADOS E CONSTANTES ---
const TAX_TABLES = { I: [{limit:180000,rate:0.04,deducao:0},{limit:360000,rate:0.073,deducao:5940},{limit:720000,rate:0.095,deducao:13860},{limit:1800000,rate:0.107,deducao:22500},{limit:3600000,rate:0.143,deducao:87300},{limit:4800000,rate:0.19,deducao:378000}], II: [{limit:180000,rate:0.045,deducao:0},{limit:360000,rate:0.078,deducao:5940},{limit:720000,rate:0.10,deducao:13860},{limit:1800000,rate:0.112,deducao:22500},{limit:3600000,rate:0.147,deducao:85500},{limit:4800000,rate:0.30,deducao:720000}], III: [{limit:180000,rate:0.06,deducao:0},{limit:360000,rate:0.112,deducao:9360},{limit:720000,rate:0.135,deducao:17640},{limit:1800000,rate:0.16,deducao:35640},{limit:3600000,rate:0.21,deducao:125640},{limit:4800000,rate:0.33,deducao:648000}], IV: [{limit:180000,rate:0.045,deducao:0},{limit:360000,rate:0.09,deducao:8100},{limit:720000,rate:0.102,deducao:12420},{limit:1800000,rate:0.14,deducao:39780},{limit:3600000,rate:0.22,deducao:183780},{limit:4800000,rate:0.33,deducao:828000}], V: [{limit:180000,rate:0.155,deducao:0},{limit:360000,rate:0.18,deducao:4500},{limit:720000,rate:0.195,deducao:9900},{limit:1800000,rate:0.205,deducao:17100},{limit:3600000,rate:0.23,deducao:62100},{limit:4800000,rate:0.305,deducao:540000}] };
const IRRF_TABLE_2025 = [{limit:2428.80,rate:0,deducao:0},{limit:2826.65,rate:0.075,deducao:182.16},{limit:3751.05,rate:0.15,deducao:394.16},{limit:4664.68,rate:0.225,deducao:675.49},{limit:99999999,rate:0.275,deducao:908.73}];
const INSS_TETO_2025 = 8157.41;
const IRRF_DESCONTO_SIMPLIFICADO = 607.20; 
const SALARIO_MINIMO_2025 = 1518.00;
const EXPENSE_CATEGORIES = ["Aluguel / Condomínio", "Água / Luz / Internet", "Softwares e Assinaturas", "Marketing e Anúncios", "Transporte", "Material de Escritório", "Serviços Terceiros", "Taxas Bancárias", "Manutenção", "Outros"];
const COLORS = { Faturamento: '#3b82f6', Lucro: '#10b981', Impostos: '#ef4444', Operacional: '#f59e0b', Pessoal: '#3b82f6' };

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  
  // States Globais
  const [historyData, setHistoryData] = useState([]);
  const [globalDas, setGlobalDas] = useState(0);
  const [globalProlabore, setGlobalProlabore] = useState(0);
  const [globalFaturamento, setGlobalFaturamento] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); if(session) fetchProfile(session.user.id); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); if(session) fetchProfile(session.user.id); setLoading(false); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) fetchHistory(); }, [session]);

  const fetchHistory = async () => {
    const { data } = await supabase.from('financial_history').select('*').order('month', { ascending: true });
    setHistoryData(data || []);
  };

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setUserProfile(data);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setHistoryData([]); setUserProfile(null); };

  if (loading) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',color:'#1e3a8a'}}>Carregando LZL Cont...</div>;
  if (!session) return <LoginScreen />;

  return (
    <div className="app-container">
      <Header userEmail={session.user.email} userProfile={userProfile} onLogout={handleLogout} />
      <Dashboard 
        session={session} historyData={historyData} refreshData={fetchHistory} userProfile={userProfile} refreshProfile={() => fetchProfile(session.user.id)}
        globalDas={globalDas} setGlobalDas={setGlobalDas}
        globalProlabore={globalProlabore} setGlobalProlabore={setGlobalProlabore}
        globalFaturamento={globalFaturamento} setGlobalFaturamento={setGlobalFaturamento}
      />
    </div>
  );
}

// --- TELA DE LOGIN/CADASTRO (COM CORREÇÃO DE EMAIL) ---
function LoginScreen() {
  const [viewState, setViewState] = useState("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formData, setFormData] = useState({ full_name: "", cpf: "", birth_date: "", phone: "", company_name: "", cnpj: "", address: "" });

  const handleInputChange = (e) => { setFormData({...formData, [e.target.name]: e.target.value}); };

  const handleAuth = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (viewState === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data?.user) {
            // CORREÇÃO CRÍTICA: Salvando email e role no perfil
            const { error: profileError } = await supabase.from('profiles').upsert([{ 
                id: data.user.id, 
                email: email, // Essencial para a lista do contador
                role: 'client', 
                ...formData 
            }]);
            if (profileError) throw profileError;
        }
        alert("Cadastro realizado! Bem-vindo ao LZL Cont.");
      } else if (viewState === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (viewState === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        alert("Link enviado!"); setViewState("login");
      }
    } catch (error) { alert(error.message); } finally { setLoading(false); }
  };

  return (
    <div className="login-screen">
      <div className="login-box" style={{maxWidth: viewState === 'signup' ? '600px' : '400px'}}>
        <h1>LZL Cont</h1>
        <p>{viewState === "login" ? "Portal do Cliente" : viewState === "signup" ? "Cadastro de Empresa" : "Recuperar Senha"}</p>
        <form onSubmit={handleAuth}>
          <div className="input-group"><label>E-mail</label><input type="email" className="login-input" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
          {viewState !== "forgot" && (<div className="input-group"><label>Senha</label><input type="password" className="login-input" value={password} onChange={e=>setPassword(e.target.value)} required /></div>)}
          {viewState === "signup" && (
            <div className="form-grid" style={{textAlign:'left'}}>
                <div><label>Nome Completo</label><input name="full_name" className="login-input" required onChange={handleInputChange} /></div>
                <div><label>CPF</label><input name="cpf" className="login-input" required onChange={handleInputChange} /></div>
                <div><label>Data Nasc.</label><input type="date" name="birth_date" className="login-input" required onChange={handleInputChange} /></div>
                <div><label>Celular</label><input name="phone" className="login-input" required onChange={handleInputChange} /></div>
                <div className="full-width"><label>Razão Social</label><input name="company_name" className="login-input" required onChange={handleInputChange} /></div>
                <div><label>CNPJ</label><input name="cnpj" className="login-input" required onChange={handleInputChange} /></div>
                <div><label>Endereço</label><input name="address" className="login-input" required onChange={handleInputChange} /></div>
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? "..." : (viewState === "signup" ? "Finalizar" : viewState === "forgot" ? "Enviar Link" : "Entrar")}</button>
        </form>
        <div style={{marginTop:'15px', display:'flex', flexDirection:'column', gap:'10px'}}>
            {viewState === "login" && (<><button onClick={() => setViewState("signup")} style={{background:'none', border:'none', color:'#3b82f6', cursor:'pointer', textDecoration:'underline'}}>Criar conta</button><button onClick={() => setViewState("forgot")} style={{background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:'0.9rem'}}>Esqueci senha</button></>)}
            {viewState !== "login" && (<button onClick={() => setViewState("login")} style={{background:'none', border:'none', color:'#3b82f6', cursor:'pointer', textDecoration:'underline'}}>Voltar</button>)}
        </div>
      </div>
    </div>
  );
}

function Header({ userEmail, userProfile, onLogout }) {
  const openWhatsApp = () => { 
    const razaoSocial = userProfile?.company_name || "minha empresa";
    window.open(`https://wa.me/5511912107758?text=${encodeURIComponent(`Olá! Represento a ${razaoSocial} e preciso de ajuda no LZL Cont.`)}`, '_blank'); 
  };
  const getInitials = () => {
    if (userProfile?.company_name) return userProfile.company_name.substring(0,2).toUpperCase();
    return userEmail ? userEmail.substring(0,2).toUpperCase() : "US";
  };
  return (
    <div className="header">
      <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
        <div style={{width:'45px', height:'45px', background:'white', color:'#1e3a8a', borderRadius:'50%', display:'flex', justifyContent:'center', alignItems:'center', fontWeight:'bold', fontSize:'1.1rem'}}>{getInitials()}</div>
        <div>
            <h2>LZL Cont | Painel</h2>
            <span style={{ opacity: 0.8, fontSize: "0.9rem" }}>{userProfile ? userProfile.company_name : userEmail}</span>
            {userProfile?.role === 'admin' && <span style={{marginLeft:'10px', background:'#fcd34d', color:'#000', padding:'2px 6px', borderRadius:'4px', fontSize:'0.7rem', fontWeight:'bold'}}>ADMIN</span>}
        </div>
      </div>
      <div style={{display:'flex', gap:'10px'}}>
        <button onClick={openWhatsApp} className="btn-logout" style={{backgroundColor: '#25D366', display:'flex', alignItems:'center', gap:'5px'}}><span>📞</span> Suporte</button>
        <button onClick={onLogout} className="btn-logout">Sair</button>
      </div>
    </div>
  );
}

function Dashboard({ session, historyData, refreshData, userProfile, refreshProfile, globalDas, setGlobalDas, globalProlabore, setGlobalProlabore, globalFaturamento, setGlobalFaturamento }) {
  const [activeTab, setActiveTab] = useState("visao"); 
  const isAdmin = userProfile?.role === 'admin';
  return (
    <div className="main-content">
      <div className="tabs">
        {isAdmin && <button className={`tab-btn ${activeTab === "admin" ? "active" : ""}`} onClick={() => setActiveTab("admin")} style={{color: '#dc2626'}}>🕵️‍♂️ Painel Contador</button>}
        <button className={`tab-btn ${activeTab === "visao" ? "active" : ""}`} onClick={() => setActiveTab("visao")}>👁️ Visão Geral</button>
        <button className={`tab-btn ${activeTab === "docs" ? "active" : ""}`} onClick={() => setActiveTab("docs")}>📂 Documentos</button>
        <button className={`tab-btn ${activeTab === "simples" ? "active" : ""}`} onClick={() => setActiveTab("simples")}>📊 Simples</button>
        <button className={`tab-btn ${activeTab === "prolabore" ? "active" : ""}`} onClick={() => setActiveTab("prolabore")}>💼 Pro-Labore</button>
        <button className={`tab-btn ${activeTab === "lucro" ? "active" : ""}`} onClick={() => setActiveTab("lucro")}>💰 Lucro</button>
        <button className={`tab-btn ${activeTab === "perfil" ? "active" : ""}`} onClick={() => setActiveTab("perfil")}>⚙️ Meu Perfil</button>
      </div>
      {isAdmin && <div style={{ display: activeTab === "admin" ? "block" : "none" }}><AdminPanel session={session} /></div>}
      <div style={{ display: activeTab === "visao" ? "block" : "none" }}><OverviewTab historyData={historyData} userEmail={session.user.email} userProfile={userProfile} /></div>
      <div style={{ display: activeTab === "docs" ? "block" : "none" }}><DocumentsTab session={session} /></div>
      <div style={{ display: activeTab === "simples" ? "block" : "none" }}><SimplesCalculator setGlobalDas={setGlobalDas} setGlobalFaturamento={setGlobalFaturamento} globalProlabore={globalProlabore} /></div>
      <div style={{ display: activeTab === "prolabore" ? "block" : "none" }}><ProLaboreCalculator setGlobalProlabore={setGlobalProlabore} /></div>
      <div style={{ display: activeTab === "lucro" ? "block" : "none" }}><ProfitSimulator session={session} historyData={historyData} refreshData={refreshData} globalDas={globalDas} globalProlabore={globalProlabore} globalFaturamento={globalFaturamento} /></div>
      <div style={{ display: activeTab === "perfil" ? "block" : "none" }}><ProfileTab userProfile={userProfile} refreshProfile={refreshProfile} session={session} /></div>
    </div>
  );
}

// --- PAINEL DO CONTADOR ---
function AdminPanel({ session }) {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState("Guia de Imposto (DAS/DARF)");
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    // Busca clientes para o dropdown (agora com email garantido)
    const { data, error } = await supabase.from('profiles').select('id, full_name, company_name, email').neq('role', 'admin');
    if (!error) setClients(data || []);
  };

  const handleAdminUpload = async (e) => {
    e.preventDefault(); if (!file || !selectedClient) return alert("Selecione um cliente e um arquivo."); setUploading(true);
    try {
      const fileExt = file.name.split('.').pop(); const fileName = `${Math.random()}.${fileExt}`; const filePath = `${selectedClient}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file); if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from('document_metadata').insert([{ user_id: selectedClient, file_name: file.name, file_type: docType, file_url: filePath }]); if (dbError) throw dbError;
      alert("Arquivo enviado para o cliente!"); setFile(null);
    } catch (error) { alert("Erro Admin: " + error.message); } finally { setUploading(false); }
  };

  return (
    <div className="card" style={{border: '2px solid #dc2626'}}>
      <h3 style={{color: '#dc2626'}}>🕵️‍♂️ Painel do Contador</h3><p style={{marginBottom:'20px'}}>Envie documentos para seus clientes.</p>
      <form onSubmit={handleAdminUpload} style={{background: '#fef2f2', padding: '20px', borderRadius: '8px'}}>
        <div className="form-grid">
            <div className="full-width"><label style={{fontWeight:'bold'}}>Selecione o Cliente</label>
                <select className="login-input" value={selectedClient} onChange={e => setSelectedClient(e.target.value)} required>
                    <option value="">-- Escolha --</option>
                    {clients.map(c => (<option key={c.id} value={c.id}>{c.company_name} ({c.email || c.full_name})</option>))}
                </select>
            </div>
            <div><label style={{fontWeight:'bold'}}>Tipo</label><select className="login-input" value={docType} onChange={e => setDocType(e.target.value)}><option>Guia de Imposto (DAS/DARF)</option><option>Folha de Pagamento</option><option>Contrato Social</option><option>Balanço/DRE</option><option>Outros</option></select></div>
            <div><label style={{fontWeight:'bold'}}>Arquivo (PDF)</label><input type="file" className="login-input" onChange={e => setFile(e.target.files[0])} required /></div>
        </div>
        <button type="submit" className="btn-primary" style={{background: '#dc2626'}} disabled={uploading}>{uploading ? "Enviando..." : "🚀 Enviar"}</button>
      </form>
    </div>
  );
}

// --- DOCUMENTOS ---
function DocumentsTab({ session }) {
  const [file, setFile] = useState(null); const [uploading, setUploading] = useState(false); const [docType, setDocType] = useState("Outros"); const [documents, setDocuments] = useState([]);
  useEffect(() => { fetchDocuments(); }, []);
  const fetchDocuments = async () => { const { data } = await supabase.from('document_metadata').select('*').order('created_at', { ascending: false }); setDocuments(data || []); };
  const handleUpload = async (e) => { e.preventDefault(); if (!file) return alert("Selecione um arquivo."); setUploading(true); try { const fileExt = file.name.split('.').pop(); const fileName = `${Math.random()}.${fileExt}`; const filePath = `${session.user.id}/${fileName}`; const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file); if (uploadError) throw uploadError; const { error: dbError } = await supabase.from('document_metadata').insert([{ user_id: session.user.id, file_name: file.name, file_type: docType, file_url: filePath }]); if (dbError) throw dbError; alert("Arquivo enviado!"); setFile(null); fetchDocuments(); } catch (error) { alert("Erro: " + error.message); } finally { setUploading(false); } };
  const handleDownload = async (path, fileName) => { try { const { data, error } = await supabase.storage.from('documents').download(path); if (error) throw error; const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); } catch (error) { alert("Erro ao baixar: " + error.message); } };
  return ( <div className="card"><h3>Gestão de Documentos</h3><p style={{marginBottom: '20px', color: '#666', fontSize:'0.9rem'}}>Seus documentos e guias.</p><div style={{background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '2px dashed #cbd5e1', marginBottom: '30px'}}><form onSubmit={handleUpload} style={{display:'flex', gap:'15px', alignItems:'flex-end', flexWrap:'wrap'}}><div style={{flex: 1, minWidth:'200px'}}><label style={{display:'block', marginBottom:'5px', fontWeight:'bold'}}>Selecione o Arquivo</label><input type="file" className="login-input" onChange={e => setFile(e.target.files[0])} /></div><div style={{minWidth:'150px'}}><label style={{display:'block', marginBottom:'5px', fontWeight:'bold'}}>Tipo</label><select className="login-input" value={docType} onChange={e => setDocType(e.target.value)}><option>Comprovante Pagamento</option><option>Nota Fiscal</option><option>Documentos Empresa</option><option>Outros</option></select></div><button type="submit" disabled={uploading} className="btn-primary" style={{width:'auto', margin:0}}>{uploading ? "Enviando..." : "⬆️ Enviar Arquivo"}</button></form></div><h3>Arquivos Recentes</h3>{documents.length > 0 ? (<table style={{width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", marginTop: '10px'}}><thead style={{background: "#f1f5f9"}}><tr><th style={{padding:'10px', textAlign:'left'}}>Nome</th><th style={{padding:'10px', textAlign:'left'}}>Tipo</th><th style={{padding:'10px', textAlign:'left'}}>Data</th><th style={{padding:'10px', textAlign:'right'}}>Ação</th></tr></thead><tbody>{documents.map(doc => (<tr key={doc.id} style={{borderBottom: "1px solid #eee"}}><td style={{padding:'10px', display:'flex', alignItems:'center', gap:'8px'}}><span style={{fontSize:'1.2rem'}}>📄</span> {doc.file_name}</td><td style={{padding:'10px'}}><span className="history-badge">{doc.file_type}</span></td><td style={{padding:'10px'}}>{new Date(doc.created_at).toLocaleDateString()}</td><td style={{padding:'10px', textAlign:'right'}}><button onClick={() => handleDownload(doc.file_url, doc.file_name)} style={{background:'none', border:'1px solid #3b82f6', color:'#3b82f6', borderRadius:'4px', padding:'5px 10px', cursor:'pointer'}}>⬇️ Baixar</button></td></tr>))}</tbody></table>) : (<p style={{color:'#999', textAlign:'center', padding:'20px'}}>Nenhum documento.</p>)}</div> );
}

// --- PERFIL ---
function ProfileTab({ userProfile, refreshProfile, session }) {
  const [formData, setFormData] = useState({}); const [loading, setLoading] = useState(false);
  useEffect(() => { if(userProfile) setFormData(userProfile); }, [userProfile]);
  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});
  const handleSave = async (e) => { e.preventDefault(); setLoading(true); try { const updates = { id: session.user.id, ...formData, updated_at: new Date() }; const { error } = await supabase.from('profiles').upsert(updates); if (error) throw error; alert("Perfil atualizado!"); refreshProfile(); } catch (error) { alert("Erro: " + error.message); } finally { setLoading(false); } };
  return ( <div className="card"><h3>Meus Dados Cadastrais</h3><form onSubmit={handleSave}><div className="form-grid"><div className="full-width"><label>Nome Completo</label><input name="full_name" className="login-input" value={formData.full_name || ''} onChange={handleChange} /></div><div><label>CPF</label><input name="cpf" className="login-input" value={formData.cpf || ''} onChange={handleChange} /></div><div><label>Celular</label><input name="phone" className="login-input" value={formData.phone || ''} onChange={handleChange} /></div><div className="full-width"><label>Razão Social</label><input name="company_name" className="login-input" value={formData.company_name || ''} onChange={handleChange} /></div><div><label>CNPJ</label><input name="cnpj" className="login-input" value={formData.cnpj || ''} onChange={handleChange} /></div><div><label>Endereço</label><input name="address" className="login-input" value={formData.address || ''} onChange={handleChange} /></div></div><button type="submit" className="btn-primary" disabled={loading}>{loading ? "Salvando..." : "💾 Salvar Alterações"}</button></form></div> );
}

// --- VISÃO GERAL ---
function OverviewTab({ historyData, userEmail, userProfile }) {
  const [filterOption, setFilterOption] = useState('last_12'); 
  const filteredData = useMemo(() => { if (!historyData || historyData.length === 0) return []; const now = new Date(); let startDate = new Date(); switch (filterOption) { case 'current_month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break; case 'last_month': startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); const endDate = new Date(now.getFullYear(), now.getMonth(), 0); return historyData.filter(item => { const d = new Date(item.month + '-01'); return d >= startDate && d <= endDate; }); case 'last_3': startDate.setMonth(now.getMonth() - 3); break; case 'ytd': startDate = new Date(now.getFullYear(), 0, 1); break; case 'all': default: return historyData; case 'last_12': startDate.setMonth(now.getMonth() - 12); break; } startDate.setDate(1); return historyData.filter(item => new Date(item.month + '-01') >= startDate); }, [historyData, filterOption]);
  const chartDataArea = filteredData.map(item => { const totalExpenses = item.expense_tax + item.expense_labor + item.expense_ops; return { name: item.month.split('-').reverse().join('/').substring(0, 5), fullDate: item.month.split('-').reverse().join('/'), Faturamento: item.revenue + (item.other_revenue || 0), Lucro: (item.revenue + (item.other_revenue || 0)) - totalExpenses }; });
  const totalCustos = filteredData.reduce((acc, item) => ({ tax: acc.tax + item.expense_tax, labor: acc.labor + item.expense_labor, ops: acc.ops + item.expense_ops }), { tax: 0, labor: 0, ops: 0 });
  const chartDataPie = [ { name: 'Impostos', value: totalCustos.tax, color: COLORS.Impostos }, { name: 'Operacional', value: totalCustos.ops, color: COLORS.Operacional }, { name: 'Pessoal', value: totalCustos.labor, color: COLORS.Pessoal }, ].filter(item => item.value > 0);
  const totalRev = chartDataArea.reduce((acc, cur) => acc + cur.Faturamento, 0); const totalProf = chartDataArea.reduce((acc, cur) => acc + cur.Lucro, 0); const margin = totalRev > 0 ? (totalProf / totalRev) * 100 : 0;
  const generatePDF = () => { const doc = new jsPDF(); doc.setFillColor(30, 58, 138); doc.rect(0, 0, 210, 40, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text("LZL Cont - Relatório Gerencial", 105, 20, null, null, "center"); const nomeCliente = userProfile?.company_name || userEmail; doc.setFontSize(10); doc.text(`Cliente: ${nomeCliente} | CNPJ: ${userProfile?.cnpj || '-'}`, 105, 30, null, null, "center"); doc.setTextColor(0, 0, 0); doc.setFontSize(12); doc.text("Extrato Financeiro do Período", 14, 50); const tableData = filteredData.map(item => { const totalExp = item.expense_tax + item.expense_labor + item.expense_ops; const prof = (item.revenue + (item.other_revenue || 0)) - totalExp; return [item.month.split('-').reverse().join('/'), `R$ ${item.revenue.toLocaleString()}`, `R$ ${item.expense_tax.toLocaleString()}`, `R$ ${prof.toLocaleString()}`]; }); autoTable(doc, { startY: 55, head: [['Mês', 'Receita', 'Impostos', 'Lucro']], body: tableData, theme: 'grid', headStyles: { fillColor: [30, 58, 138] } }); doc.save(`LZL_Cont_Relatorio_${filterOption}.pdf`); };
  const CustomTooltipArea = ({ active, payload }) => { if (active && payload && payload.length) { return ( <div style={{background:'white', padding:'10px', border:'1px solid #ccc', borderRadius:'5px', boxShadow:'0 2px 5px rgba(0,0,0,0.1)'}}> <p style={{fontWeight:'bold', marginBottom:'5px', fontSize:'0.9rem'}}>{payload[0].payload.fullDate}</p> <p style={{color: COLORS.Faturamento, margin:0, fontSize:'0.85rem'}}>Faturamento: R$ {payload[0].value.toLocaleString()}</p> <p style={{color: COLORS.Lucro, margin:0, fontSize:'0.85rem'}}>Lucro: R$ {payload[1].value.toLocaleString()}</p> </div> ); } return null; };
  return ( <div> <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'10px'}}> <div style={{display:'flex', alignItems:'center', gap:'10px'}}> <label style={{fontWeight:'bold', color:'#1e3a8a'}}>Período:</label> <select className="login-input" style={{width:'auto', padding:'8px'}} value={filterOption} onChange={(e) => setFilterOption(e.target.value)}> <option value="last_12">Últimos 12 Meses</option> <option value="current_month">Mês Atual</option> <option value="last_3">Últimos 3 Meses</option> <option value="ytd">Ano Atual (YTD)</option> <option value="all">Histórico Completo</option> </select> </div> <button onClick={generatePDF} className="btn-primary" style={{width:'auto', padding:'8px 15px', fontSize:'0.9rem', margin:0}}>📄 Baixar Relatório</button> </div> <div className="form-grid" style={{marginBottom: '20px'}}> <div className="card" style={{textAlign:'center', padding:'20px'}}> <span style={{fontSize:'0.9rem', color:'#666'}}>Faturamento no Período</span> <h2 style={{color: COLORS.Faturamento, fontSize:'1.8rem'}}>R$ {totalRev.toLocaleString('pt-BR')}</h2> </div> <div className="card" style={{textAlign:'center', padding:'20px'}}> <span style={{fontSize:'0.9rem', color:'#666'}}>Lucro no Período</span> <h2 style={{color: COLORS.Lucro, fontSize:'1.8rem'}}>R$ {totalProf.toLocaleString('pt-BR')}</h2> </div> <div className="card" style={{textAlign:'center', padding:'20px'}}> <span style={{fontSize:'0.9rem', color:'#666'}}>Margem Média</span> <h2 style={{color:'#ea580c', fontSize:'1.8rem'}}>{margin.toFixed(1)}%</h2> </div> </div> <div style={{display:'flex', gap:'20px', flexWrap:'wrap'}}> <div className="card" style={{flex: '2', minWidth: '300px'}}> <h3 style={{display:'flex', alignItems:'center', gap:'5px', marginBottom:'20px'}}>📈 Evolução Mensal</h3> {chartDataArea.length > 0 ? ( <div style={{ width: '100%', height: 300 }}> <ResponsiveContainer> <AreaChart data={chartDataArea} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}> <defs> <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1"> <stop offset="5%" stopColor={COLORS.Faturamento} stopOpacity={0.8}/> <stop offset="95%" stopColor={COLORS.Faturamento} stopOpacity={0.1}/> </linearGradient> <linearGradient id="colorLucro" x1="0" y1="0" x2="0" y2="1"> <stop offset="5%" stopColor={COLORS.Lucro} stopOpacity={0.8}/> <stop offset="95%" stopColor={COLORS.Lucro} stopOpacity={0.1}/> </linearGradient> </defs> <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" /> <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} /> <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(value) => `${value/1000}k`} domain={[0, 'auto']} /> <RechartsTooltip content={<CustomTooltipArea />} /> <RechartsLegend verticalAlign="top" height={36} iconType="circle" /> <Area type="monotone" dataKey="Faturamento" stroke={COLORS.Faturamento} strokeWidth={2} fillOpacity={1} fill="url(#colorFat)" /> <Area type="monotone" dataKey="Lucro" stroke={COLORS.Lucro} strokeWidth={2} fillOpacity={1} fill="url(#colorLucro)" /> </AreaChart> </ResponsiveContainer> </div> ) : <div style={{textAlign:'center', color:'#999', padding:'40px'}}>Sem dados no período.</div>} </div> <div className="card" style={{flex: '1', minWidth: '300px'}}> <h3 style={{display:'flex', alignItems:'center', gap:'5px', marginBottom:'10px'}}>🍰 Distribuição de Custos</h3> {chartDataPie.length > 0 ? ( <div style={{display:'flex', alignItems:'center', height:'300px'}}> <div style={{flex: 1, height:'100%'}}> <ResponsiveContainer> <PieChart> <Pie data={chartDataPie} cx="50%" cy="50%" innerRadius="55%" outerRadius="75%" paddingAngle={5} dataKey="value"> {chartDataPie.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))} </Pie> <RechartsTooltip formatter={(value) => `R$ ${value.toLocaleString()}`} itemStyle={{color:'#333'}} contentStyle={{borderRadius:'8px', border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}} /> </PieChart> </ResponsiveContainer> </div> <div style={{flex: 0.8, display:'flex', flexDirection:'column', justifyContent:'center', gap:'12px', fontSize:'0.85rem'}}> {chartDataPie.map((item, index) => ( <div key={index} style={{display:'flex', alignItems:'center', gap:'8px'}}> <div style={{width:10, height:10, backgroundColor:item.color, borderRadius:'50%'}}></div> <span style={{color:'#555'}}>{item.name}</span> <strong style={{marginLeft:'auto', color: item.color, background: '#f3f4f6', padding: '2px 6px', borderRadius:'4px', fontSize:'0.8rem'}}> {Math.round((item.value / (totalCustos.tax + totalCustos.labor + totalCustos.ops)) * 100)}% </strong> </div> ))} </div> </div> ) : <div style={{textAlign:'center', color:'#999', padding:'40px'}}>Sem custos no período.</div>} </div> </div> </div> );
}
// --- DEMAIS CALCULADORAS (MANTIDAS IGUAIS) ---
function SimplesCalculator({ setGlobalDas, setGlobalFaturamento, globalProlabore }) { const [faturamento, setFaturamento] = useState(15000); const [rbt12, setRbt12] = useState(180000); const [anexo, setAnexo] = useState("III"); const fatorR = faturamento > 0 ? (globalProlabore / faturamento) : 0; const isFatorR_OK = fatorR >= 0.28; useEffect(() => { const res = calculateSimplesReal(); setGlobalDas(res.imposto); setGlobalFaturamento(faturamento); }, [faturamento, rbt12, anexo, globalProlabore]); const calculateSimplesReal = () => { let anexoEfetivo = anexo; if (anexo === "V" && isFatorR_OK) { anexoEfetivo = "III"; } const table = TAX_TABLES[anexoEfetivo]; const faixa = table.find(item => rbt12 <= item.limit) || table[table.length - 1]; let aliquotaEfetiva = rbt12 > 0 ? ((rbt12 * faixa.rate) - faixa.deducao) / rbt12 : table[0].rate; if (aliquotaEfetiva < 0) aliquotaEfetiva = 0; const imposto = faturamento * aliquotaEfetiva; return { imposto, aliquotaEfetiva: aliquotaEfetiva * 100, anexoUsado: anexoEfetivo }; }; const result = calculateSimplesReal(); return ( <div className="card"><h3>Calculadora Simples Nacional</h3>{(faturamento > 0 && globalProlabore > 0) && (<div style={{ marginBottom: '20px', padding: '15px', borderRadius: '8px', backgroundColor: isFatorR_OK ? '#dcfce7' : '#fef9c3', border: `1px solid ${isFatorR_OK ? '#86efac' : '#fde047'}` }}><div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px'}}><strong>🔥 Termômetro Fator R</strong><span style={{fontWeight: 'bold', fontSize: '1.1rem', color: isFatorR_OK ? '#15803d' : '#a16207'}}>{(fatorR * 100).toFixed(1)}%</span></div><div style={{width: '100%', height: '10px', background: '#e5e7eb', borderRadius: '5px', overflow: 'hidden', marginBottom: '8px'}}><div style={{width: `${Math.min(fatorR * 100, 100)}%`, height: '100%', background: isFatorR_OK ? '#22c55e' : '#eab308', transition: 'width 0.5s ease-in-out'}}></div></div><p style={{ fontSize: '0.85rem', color: '#374151' }}>{isFatorR_OK ? "✅ Excelente! Folha > 28%." : `⚠️ Atenção: Folha < 28%.`}</p></div>)}<div className="form-grid"><div className="full-width"><label>Atividade</label><select className="login-input" value={anexo} onChange={(e) => setAnexo(e.target.value)}><option value="I">Anexo I - Comércio</option><option value="III">Anexo III - Serviços</option><option value="V">Anexo V - Intelectuais</option></select></div><div><label>Faturamento Mês</label><input type="number" className="login-input" value={faturamento} onChange={(e) => setFaturamento(Number(e.target.value))} /></div><div><label>RBT12</label><input type="number" className="login-input" value={rbt12} onChange={(e) => setRbt12(Number(e.target.value))} /></div></div><div className="result-box">{result.anexoUsado !== anexo && (<div className="result-row" style={{color: '#16a34a'}}><strong>Anexo III Aplicado!</strong></div>)}<div className="result-row total"><span>Valor do DAS:</span><span>R$ {result.imposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div></div></div> ); }
function ProLaboreCalculator({ setGlobalProlabore }) { const [bruto, setBruto] = useState(SALARIO_MINIMO_2025); useEffect(() => { setGlobalProlabore(bruto); }, [bruto]); const calculateLiquido = () => { let baseInss = bruto > INSS_TETO_2025 ? INSS_TETO_2025 : bruto; const inss = baseInss * 0.11; let baseIr = (bruto - IRRF_DESCONTO_SIMPLIFICADO) < (bruto - inss) ? (bruto - IRRF_DESCONTO_SIMPLIFICADO) : (bruto - inss); let irrf = 0; const faixaIr = IRRF_TABLE_2025.find(item => baseIr <= item.limit); if (faixaIr) irrf = (baseIr * faixaIr.rate) - faixaIr.deducao; if (irrf < 0) irrf = 0; return { inss, irrf, liquido: bruto - inss - irrf }; }; const res = calculateLiquido(); return ( <div className="card"><h3>Cálculo de Pro-Labore</h3><div className="form-grid"><div className="full-width"><label>Valor Bruto</label><input type="number" className="login-input" value={bruto} onChange={(e) => setBruto(Number(e.target.value))} /></div></div><div className="result-box"><div className="result-row"><span>(-) INSS:</span><span className="alert">R$ {res.inss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div><div className="result-row"><span>(-) IRRF:</span><span className="alert">R$ {res.irrf.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div><div className="result-row total"><span>Líquido:</span><span className="highlight">R$ {res.liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div></div></div> ); }
function ProfitSimulator({ session, historyData, refreshData, globalDas, globalProlabore, globalFaturamento }) { const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7)); const [receita, setReceita] = useState(0); const [outrasReceitas, setOutrasReceitas] = useState(0); const [taxas, setTaxas] = useState(0); const [pessoal, setPessoal] = useState(0); const [loadingSave, setLoadingSave] = useState(false); const [tempDespesas, setTempDespesas] = useState([]); const [catSelecionada, setCatSelecionada] = useState(EXPENSE_CATEGORIES[0]); const [valorDespesa, setValorDespesa] = useState(""); const preencherAutomaticamente = () => { if (globalFaturamento > 0) setReceita(Number(globalFaturamento)); if (globalDas > 0) setTaxas(Number(globalDas.toFixed(2))); if (globalProlabore > 0) setPessoal(Number(globalProlabore.toFixed(2))); alert("Dados importados!"); }; const adicionarDespesa = (e) => { e.preventDefault(); if (!valorDespesa || Number(valorDespesa) <= 0) return; setTempDespesas([...tempDespesas, { id: Date.now(), categoria: catSelecionada, valor: Number(valorDespesa) }]); setValorDespesa(""); }; const removerDespesa = (id) => setTempDespesas(tempDespesas.filter(item => item.id !== id)); const totalOperacional = tempDespesas.reduce((acc, item) => acc + item.valor, 0); const handleSave = async () => { if (receita === 0 && outrasReceitas === 0) return alert("Preencha a receita."); setLoadingSave(true); const newEntry = { user_id: session.user.id, month: competencia, revenue: receita, other_revenue: outrasReceitas, expense_tax: taxas, expense_labor: pessoal, expense_ops: totalOperacional }; try { const { error } = await supabase.from('financial_history').upsert(newEntry, { onConflict: 'user_id, month' }); if (error) throw error; alert("Salvo na nuvem!"); setReceita(0); setOutrasReceitas(0); setTaxas(0); setPessoal(0); setTempDespesas([]); refreshData(); } catch (error) { alert("Erro: " + error.message); } finally { setLoadingSave(false); } }; const formatDate = (iso) => iso ? iso.split('-').reverse().join('/') : '-'; return ( <div className="card"><div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}><h3>Apuração de Lucro</h3><input type="month" className="login-input" style={{width:'auto', padding:'5px'}} value={competencia} onChange={(e) => setCompetencia(e.target.value)} /></div><div style={{background: "#eff6ff", padding: "10px", borderRadius: "8px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center"}}><span style={{color: "#1e40af", fontSize:'0.9rem'}}>Importar das abas?</span><button onClick={preencherAutomaticamente} className="btn-primary" style={{marginTop: 0, width: "auto", padding: "5px 15px"}}>⚡ Importar</button></div><div className="form-grid"><div><label>Receita</label><input type="number" className="login-input" value={receita} onChange={(e) => setReceita(Number(e.target.value))} /></div><div><label>Outras</label><input type="number" className="login-input" value={outrasReceitas} onChange={(e) => setOutrasReceitas(Number(e.target.value))} /></div><div><label>Impostos</label><input type="number" className="login-input" value={taxas} onChange={(e) => setTaxas(Number(e.target.value))} /></div><div><label>Pessoal</label><input type="number" className="login-input" value={pessoal} onChange={(e) => setPessoal(Number(e.target.value))} /></div></div><div style={{background: "#f9fafb", padding: "15px", borderRadius: "8px", marginBottom: "20px"}}><div style={{display: "flex", gap: "10px", alignItems: "flex-end"}}><div style={{flex: 2}}><label>Categoria</label><select className="login-input" value={catSelecionada} onChange={(e) => setCatSelecionada(e.target.value)}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div style={{flex: 1}}><label>Valor</label><input type="number" className="login-input" value={valorDespesa} onChange={(e) => setValorDespesa(e.target.value)} /></div><button onClick={adicionarDespesa} className="btn-primary" style={{width: "auto", margin: 0}}>Add</button></div>{tempDespesas.length > 0 && <div style={{marginTop: '10px', fontSize:'0.9rem'}}>Variáveis: R$ {totalOperacional.toLocaleString()}</div>}</div><button className="btn-primary" onClick={handleSave} disabled={loadingSave}>{loadingSave ? "Salvando..." : `💾 Salvar Fechamento (${formatDate(competencia)})`}</button><div style={{overflowX: 'auto', marginTop:'20px'}}><table style={{width: "100%", borderCollapse: "collapse", fontSize: "0.85rem"}}><thead style={{background: "#f1f5f9"}}><tr><th style={{padding:'8px', textAlign:'left'}}>Mês</th><th style={{padding:'8px', textAlign:'right'}}>Receita</th><th style={{padding:'8px', textAlign:'right'}}>Lucro</th></tr></thead><tbody>{historyData.map((item, index) => { const profit = (item.revenue + (item.other_revenue||0)) - (item.expense_tax + item.expense_labor + item.expense_ops); return (<tr key={index} style={{borderBottom: "1px solid #eee"}}><td style={{padding:'8px'}}>{formatDate(item.month)}</td><td style={{padding:'8px', textAlign:'right'}}>{item.revenue.toLocaleString()}</td><td style={{padding:'8px', textAlign:'right', fontWeight:'bold', color: profit>=0?'black':'red'}}>{profit.toLocaleString()}</td></tr>) })}</tbody></table></div></div> ); }