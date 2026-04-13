import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api' // IMPORTUL NOSTRU MAGIC IN LOC DE FIREBASE
import {
  Heart, Users, Bell, LogOut, Plus,
  Activity, Thermometer, User, ChevronRight, Menu, X,
  Save
} from 'lucide-react'

const pacientiInitiali = []

const campGol = {
  nume: '', prenume: '', varsta: '', cnp: '', telefon: '', email: '',
  strada: '', oras: '', judet: '', profesie: '', locMunca: '',
  istoricMedical: '', alergii: '', consultatiiCardiologice: '',
  pulsMin: '60', pulsMax: '100', tempMin: '36', tempMax: '37.5',
}

function Field({ label, placeholder, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-purple-500 focus:ring-1 focus:ring-blue-500"
      />
    </div>
  )
}

function TextArea({ label, placeholder, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        rows={3}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-purple-500 focus:ring-1 focus:ring-blue-500 resize-none"
      />
    </div>
  )
}

function DashboardMedic() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [paginaActiva, setPaginaActiva] = useState('pacienti')
  const [pacienti, setPacienti] = useState(pacientiInitiali)
  const [modalDeschis, setModalDeschis] = useState(false)
  const [formData, setFormData] = useState(campGol)
  const [tabForm, setTabForm] = useState('demografice')
  const navigate = useNavigate()

  const incarcaPacienti = async () => {
    try {
      const uid = sessionStorage.getItem('uid')
      // Cerem lista de pacienti de la serverul nostru
      const response = await api.get(`/pacienti/${uid}`)
      setPacienti(response.data)
    } catch (err) {
      console.error('Eroare la încărcare pacienți:', err)
    }
  }

  useEffect(() => {
    incarcaPacienti()

    // Adăugăm un timer pentru a reîncărca lista de pacienți periodic
    const interval = setInterval(incarcaPacienti, 5000);
    return () => clearInterval(interval);
  }, [])

  const statusColor = (status) => {
    if (status === 'ok') return 'bg-green-100 text-green-700'
    if (status === 'warn') return 'bg-yellow-100 text-yellow-700'
    if (status === 'alarm') return 'bg-red-100 text-red-700'
  }

  const statusText = (status) => {
    if (status === 'ok') return 'Normal'
    if (status === 'warn') return 'Avertizare'
    if (status === 'alarm') return 'Alarmă'
  }

  const getStatusDinTemperatura = (temperatura) => {
    if (temperatura >= 38.5) return 'alarma'
    if (temperatura >= 37.5) return 'avertizare'
    return 'ok'
  }

  const handleSalveaza = async () => {
    try {
      const uid = sessionStorage.getItem('uid')
      
      const datePacientNou = {
        nume: formData.nume,
        prenume: formData.prenume,
        varsta: parseInt(formData.varsta) || 0,
        cnp: formData.cnp,
        telefon: formData.telefon,
        email: formData.email,
        strada: formData.strada,
        oras: formData.oras,
        judet: formData.judet,
        profesie: formData.profesie,
        locMunca: formData.locMunca,
        istoricMedical: formData.istoricMedical,
        alergii: formData.alergii,
        consultatiiCardiologice: formData.consultatiiCardiologice,
        pulsMin: parseInt(formData.pulsMin),
        pulsMax: parseInt(formData.pulsMax),
        tempMin: parseFloat(formData.tempMin),
        tempMax: parseFloat(formData.tempMax),
        puls: 75,
        temperatura: 36.6,
        ecg: 'Normal',
        status: 'ok',
        medicUid: uid,
      }

      // Trimitem datele catre baza de date via Server
      const response = await api.post('/pacienti', datePacientNou)
      const pacientAdaugat = response.data.pacient

      // Generam masuratori simulate apeland ruta ta existenta de senzori
      for (let i = 8; i <= 16; i++) {
        await api.post('/senzori', {
          id_pacient: pacientAdaugat._id, // MongoDB foloseste _id
          puls_mediu: Math.floor(70 + Math.random() * 30),
          temperatura_medie: parseFloat((36.2 + Math.random() * 1.5).toFixed(1)),
          timestamp: new Date(new Date().setHours(i, 0, 0, 0)) // Setam ora simulata
        })
      }

      await incarcaPacienti()
      setModalDeschis(false)
      setFormData(campGol)
      setTabForm('demografice')
    } catch (err) {
      console.error('Eroare la salvare:', err)
      alert('Eroare la salvare. Verifica consola.')
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'} bg-white shadow-lg transition-all duration-300 flex flex-col`}>
        <div className="flex items-center gap-3 p-6 border-b border-gray-100">
          <div className="bg-purple-600 rounded-full p-2">
            <Heart className="text-white" size={20} />
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm">Sănătatea Noastră</p>
            <p className="text-xs text-gray-500">Portal Medic</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'pacienti', icon: <Users size={18} />, label: 'Pacienții mei' },
            { id: 'alarme', icon: <Bell size={18} />, label: 'Alarme & Avertizări' },
            { id: 'monitorizare', icon: <Activity size={18} />, label: 'Monitorizare Live' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPaginaActiva(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                paginaActiva === item.id ? 'bg-purple-50 text-purple-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-purple-100 rounded-full p-2">
              <User size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{sessionStorage.getItem('nume') || 'Medic'}</p>
              <p className="text-xs text-gray-500">Medic</p>
            </div>
          </div>
          <button
            onClick={() => { sessionStorage.clear(); navigate('/') }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={16} />
            Deconectare
          </button>
        </div>
      </div>

      {/* Continut principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 hover:text-gray-700">
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <h1 className="text-lg font-bold text-gray-800">
              {paginaActiva === 'pacienti' && 'Pacienții mei'}
              {paginaActiva === 'alarme' && 'Alarme & Avertizări'}
              {paginaActiva === 'monitorizare' && 'Monitorizare Live'}
            </h1>
          </div>
          <button
            onClick={() => setModalDeschis(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <Plus size={16} />
            Pacient nou
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">Total Pacienți</p>
                <div className="bg-purple-100 rounded-full p-2"><Users size={16} className="text-purple-600" /></div>
              </div>
              <p className="text-3xl font-bold text-gray-800">{pacienti.length}</p>
              <p className="text-xs text-green-500 mt-1">↑ 1 nou această săptămână</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">Alarme Active</p>
                <div className="bg-red-100 rounded-full p-2"><Bell size={16} className="text-red-500" /></div>
              </div>
              <p className="text-3xl font-bold text-gray-800">{pacienti.filter(p => getStatusDinTemperatura(p.temperatura) === 'alarm').length}</p>
              <p className="text-xs text-red-500 mt-1">↑ Necesită atenție</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">Avertizări</p>
                <div className="bg-yellow-100 rounded-full p-2"><Activity size={16} className="text-yellow-500" /></div>
              </div>
              <p className="text-3xl font-bold text-gray-800">{pacienti.filter(p => getStatusDinTemperatura(p.temperatura) === 'warn').length}</p>
              <p className="text-xs text-yellow-500 mt-1">→ De monitorizat</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Lista Pacienților</h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Pacient</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Vârstă</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Puls</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Temperatură</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ECG</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pacienti.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 rounded-full p-2"><User size={14} className="text-purple-600" /></div>
                        <span className="text-sm font-medium text-gray-800">{p.prenume} {p.nume}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.varsta} ani</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Heart size={14} className="text-red-400" />
                        <span className="text-sm text-gray-600">{p.puls} bpm</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Thermometer size={14} className="text-orange-400" />
                        <span className="text-sm text-gray-600">{p.temperatura}°C</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.ecg}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(p.status)}`}>
                        {statusText(p.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/fisa/${p._id}`)}
                        className="flex items-center gap-1 text-purple-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Vezi fișa <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL PACIENT NOU */}
      {modalDeschis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 rounded-full p-2">
                  <User size={20} className="text-purple-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Pacient Nou</h2>
              </div>
              <button onClick={() => setModalDeschis(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <div className="flex border-b border-gray-100 px-6">
              {[
                { id: 'demografice', label: 'Date Demografice' },
                { id: 'medicale', label: 'Date Medicale' },
                { id: 'valori', label: 'Valori Normale' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTabForm(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    tabForm === tab.id
                      ? 'border-blue-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {tabForm === 'demografice' && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Nume" placeholder="ex: Popescu" value={formData.nume} onChange={e => setFormData({...formData, nume: e.target.value})} />
                  <Field label="Prenume" placeholder="ex: Ion" value={formData.prenume} onChange={e => setFormData({...formData, prenume: e.target.value})} />
                  <Field label="Vârstă" placeholder="ex: 65" type="number" value={formData.varsta} onChange={e => setFormData({...formData, varsta: e.target.value})} />
                  <Field label="CNP" placeholder="ex: 1570312034521" value={formData.cnp} onChange={e => setFormData({...formData, cnp: e.target.value})} />
                  <Field label="Telefon" placeholder="ex: 0722-123-456" value={formData.telefon} onChange={e => setFormData({...formData, telefon: e.target.value})} />
                  <Field label="Email" placeholder="ex: ion@email.com" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  <Field label="Stradă și număr" placeholder="ex: Str. Florilor nr. 12" value={formData.strada} onChange={e => setFormData({...formData, strada: e.target.value})} />
                  <Field label="Oraș" placeholder="ex: Timișoara" value={formData.oras} onChange={e => setFormData({...formData, oras: e.target.value})} />
                  <Field label="Județ" placeholder="ex: Timiș" value={formData.judet} onChange={e => setFormData({...formData, judet: e.target.value})} />
                  <Field label="Profesie" placeholder="ex: Pensionar" value={formData.profesie} onChange={e => setFormData({...formData, profesie: e.target.value})} />
                  <div className="col-span-2">
                    <Field label="Loc de muncă" placeholder="ex: Pensionat" value={formData.locMunca} onChange={e => setFormData({...formData, locMunca: e.target.value})} />
                  </div>
                </div>
              )}
              {tabForm === 'medicale' && (
                <div className="space-y-4">
                  <TextArea label="Istoric Medical" placeholder="ex: Hipertensiune arterială diagnosticată în 2015..." value={formData.istoricMedical} onChange={e => setFormData({...formData, istoricMedical: e.target.value})} />
                  <TextArea label="Alergii" placeholder="ex: Penicilină, Aspirină..." value={formData.alergii} onChange={e => setFormData({...formData, alergii: e.target.value})} />
                  <TextArea label="Consultații Cardiologice" placeholder="ex: Ultima consultație: 10.01.2026..." value={formData.consultatiiCardiologice} onChange={e => setFormData({...formData, consultatiiCardiologice: e.target.value})} />
                </div>
              )}
              {tabForm === 'valori' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">Definește valorile normale personalizate pentru acest pacient.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Puls minim (bpm)" placeholder="ex: 60" type="number" value={formData.pulsMin} onChange={e => setFormData({...formData, pulsMin: e.target.value})} />
                    <Field label="Puls maxim (bpm)" placeholder="ex: 100" type="number" value={formData.pulsMax} onChange={e => setFormData({...formData, pulsMax: e.target.value})} />
                    <Field label="Temperatură minimă (°C)" placeholder="ex: 36.0" type="number" value={formData.tempMin} onChange={e => setFormData({...formData, tempMin: e.target.value})} />
                    <Field label="Temperatură maximă (°C)" placeholder="ex: 37.5" type="number" value={formData.tempMax} onChange={e => setFormData({...formData, tempMax: e.target.value})} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-6 border-t border-gray-100">
              <button
                onClick={() => setModalDeschis(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Anulează
              </button>
              <div className="flex gap-2">
                {tabForm !== 'demografice' && (
                  <button
                    onClick={() => setTabForm(tabForm === 'valori' ? 'medicale' : 'demografice')}
                    className="px-4 py-2 text-sm text-purple-600 border border-blue-200 hover:bg-purple-50 rounded-xl transition-colors"
                  >
                    ← Înapoi
                  </button>
                )}
                {tabForm !== 'valori' ? (
                  <button
                    onClick={() => setTabForm(tabForm === 'demografice' ? 'medicale' : 'valori')}
                    className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
                  >
                    Continuă →
                  </button>
                ) : (
                  <button
                    onClick={handleSalveaza}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors"
                  >
                    <Save size={16} />
                    Salvează Pacient
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default DashboardMedic