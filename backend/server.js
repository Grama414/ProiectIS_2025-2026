const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('dotenv').config();
const mqtt = require('mqtt');

const app = express();

// Setare CORS explicita pentru a primi cereri de pe web si mobil (scapam de eroarea cu rosu)
app.use(cors({ origin: '*' }));
app.use(express.json()); 

// ==========================================
// CONECTARE BAZA DE DATE (MONGODB)
// ==========================================

// LINK MODIFICAT: Varianta "Old School" fara +srv, care rezolva ETIMEOUT pe Render
// ==========================================
// CONECTARE BAZA DE DATE (MONGODB)
// ==========================================

// Așa e corect pentru GitHub public:
const mongoURI = process.env.MONGO_URI ? process.env.MONGO_URI.trim() : '';
const usesPlaceholderMongoUri =
  !mongoURI ||
  mongoURI.includes('<username>') ||
  mongoURI.includes('<password>') ||
  mongoURI.includes('<cluster-name>') ||
  mongoURI.includes('<database-name>');

let inMemoryMongoServer = null;

async function connectToDatabase() {
  const connectionOptions = {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  };

  if (!usesPlaceholderMongoUri) {
    try {
      await mongoose.connect(mongoURI, connectionOptions);
      console.log('✅ Conectare la MongoDB reușită!');
      return 'mongo';
    } catch (error) {
      console.error('❌ Eroare la conectare MongoDB:', error);
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  console.warn('⚠️ Folosesc MongoDB in-memory pentru testare locală.');
  inMemoryMongoServer = await MongoMemoryServer.create();
  await mongoose.connect(inMemoryMongoServer.getUri(), connectionOptions);
  console.log('✅ Conectare la MongoDB in-memory reușită!');
  return 'memory';
}
  
// ==========================================
// 1. SCHEME BAZA DE DATE (MODELE)
// ==========================================

// Schema Senzori (IoT)
const SenzorSchema = new mongoose.Schema({
  id_pacient: { type: String, required: true },
  puls_mediu: Number,
  temperatura_medie: Number,
  timestamp: { type: Date, default: Date.now }
});
const Masuratoare = mongoose.model('Masuratoare', SenzorSchema, 'masuratori');

// Schema Utilizatori (Auth)
const UserSchema = new mongoose.Schema({
  nume: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  parola: { type: String, required: true },
  rol: { type: String, enum: ['admin', 'medic', 'pacient'], required: true },
  data_creare: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema, 'utilizatori');

// Schema Pacienti (Fisa Medicala)
const PacientSchema = new mongoose.Schema({
  nume: String,
  prenume: String,
  varsta: Number,
  cnp: { type: String, unique: true },
  telefon: String,
  email: String,
  strada: String,
  oras: String,
  judet: String,
  profesie: String,
  locMunca: String,
  istoricMedical: String,
  alergii: String,
  consultatiiCardiologice: String,
  pulsMin: Number,
  pulsMax: Number,
  tempMin: Number,
  tempMax: Number,
  puls: { type: Number, default: 0 },
  temperatura: { type: Number, default: 0 },
  ecg: { type: String, default: 'Normal' },
  status: { type: String, default: 'ok' },
  medicUid: String,    // Cine a creat fisa
  pacientUid: String   // Contul de pacient asociat (dupa introducerea CNP-ului)
});
const Pacient = mongoose.model('Pacient', PacientSchema, 'pacienti');

// Schema Recomandari Medicale
const RecomandareSchema = new mongoose.Schema({
  pacientId: { type: String, required: true },
  medicUid: { type: String, required: true },
  tip: String,
  durata: String,
  indicatii: String,
  timestamp: { type: Date, default: Date.now }
});
const Recomandare = mongoose.model('Recomandare', RecomandareSchema, 'recomandari');


// ==========================================
// 2. RUTE PENTRU IOT (SENZORI ARDUINO)
// ==========================================

// Preia ultima masuratoare (pentru o interogare rapida hardware daca e cazul)
app.get('/api/date-pacient/:id', async (req, res) => {
  try {
    const idPacient = req.params.id;
    const ultimaMasuratoare = await Masuratoare.findOne({ id_pacient: idPacient }).sort({ timestamp: -1 });
    
    if (ultimaMasuratoare) {
      res.json(ultimaMasuratoare);
    } else {
      res.json({ puls_mediu: "--", temperatura_medie: "--", mesaj: "Nu există date încă." });
    }
  } catch (error) {
    res.status(500).json({ error: "Eroare la preluarea datelor senzorilor" });
  }
});

// Salvare date trimise de Arduino
app.post('/api/senzori', async (req, res) => {
  try {
    const dateNoi = new Masuratoare(req.body);
    await dateNoi.save();
    console.log("📥 Date noi salvate de la senzor:", req.body);
    res.status(201).json({ mesaj: "Date salvate cu succes!" });
  } catch (error) {
    res.status(500).json({ error: "Eroare la salvarea datelor de la senzor" });
  }
});

// Preia tot istoricul de masuratori pentru a desena graficele in React
app.get('/api/masuratori/:pacientId', async (req, res) => {
  try {
    const masuratori = await Masuratoare.find({ id_pacient: req.params.pacientId }).sort({ timestamp: 1 });
    res.json(masuratori);
  } catch (error) {
    res.status(500).json({ mesaj: "Eroare la preluarea istoricului de măsurători." });
  }
});


// ==========================================
// 3. RUTE PENTRU AUTENTIFICARE (REACT)
// ==========================================

// Inregistrare
app.post('/api/register', async (req, res) => {
  try {
    const { nume, email, parola, rol } = req.body;
    
    const userExistent = await User.findOne({ email });
    if (userExistent) {
      return res.status(400).json({ mesaj: "Email-ul este deja folosit!" });
    }

    const userNou = new User({ nume, email, parola, rol });
    await userNou.save();
    
    res.status(201).json({ mesaj: "Cont creat cu succes!", utilizator: userNou });
  } catch (error) {
    res.status(500).json({ mesaj: "Eroare la crearea contului." });
  }
});

// Logare
app.post('/api/login', async (req, res) => {
  try {
    const { email, parola, rol_cerut } = req.body;
    
    const user = await User.findOne({ email, parola });
    if (!user) {
      return res.status(401).json({ mesaj: "Email sau parolă greșite!" });
    }

    if (user.rol !== rol_cerut) {
      return res.status(403).json({ mesaj: `Acest cont este de tip "${user.rol}", nu "${rol_cerut}".` });
    }

    res.json({ mesaj: "Logare reușită!", utilizator: user });
  } catch (error) {
    res.status(500).json({ mesaj: "Eroare la logare." });
  }
});


// ==========================================
// 4. RUTE PENTRU PACIENTI (FISA MEDICALA)
// ==========================================

// Medicul preia lista cu toti pacientii lui
app.get('/api/pacienti/:medicUid', async (req, res) => {
  try {
    // Folosim .lean() pentru a lucra cu obiecte simple, mai rapid
    const pacienti = await Pacient.find({ medicUid: req.params.medicUid }).lean();

    // Pentru fiecare pacient, căutăm cea mai recentă măsurătoare pentru a afișa date live
    const pacientiActualizati = await Promise.all(pacienti.map(async (pacient) => {
      const ultimaMasuratoare = await Masuratoare.findOne({ id_pacient: pacient._id.toString() }).sort({ timestamp: -1 });
      
      if (ultimaMasuratoare) {
        return {
          ...pacient,
          puls: ultimaMasuratoare.puls_mediu || pacient.puls,
          temperatura: ultimaMasuratoare.temperatura_medie || pacient.temperatura,
        };
      }
      return pacient; // Returnează pacientul original dacă nu are măsurători
    }));
    res.json(pacientiActualizati);
  } catch (error) {
    res.status(500).json({ mesaj: "Eroare la preluarea listei de pacienți." });
  }
});

// Medicul creaza o fisa noua pentru pacient
app.post('/api/pacienti', async (req, res) => {
  try {
    const pacientNou = new Pacient(req.body);
    await pacientNou.save();
    res.status(201).json({ mesaj: "Fișă pacient creată!", pacient: pacientNou });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ mesaj: "Există deja un pacient cu acest CNP în sistem!" });
    }
    res.status(500).json({ mesaj: "Eroare la crearea fișei." });
  }
});

// Preia datele unei fise specifice (dupa _id)
app.get('/api/pacient-detalii/:id', async (req, res) => {
  try {
    const fisa = await Pacient.findById(req.params.id);
    if (!fisa) return res.status(404).json({ mesaj: "Fișa nu a fost gasită." });
    res.json(fisa);
  } catch (error) {
    res.status(500).json({ mesaj: "Eroare la preluarea detaliilor." });
  }
});

// Actualizeaza o fisa (Edit)
app.put('/api/pacienti/:id', async (req, res) => {
  try {
    const pacientActualizat = await Pacient.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(pacientActualizat);
  } catch (error) {
    res.status(500).json({ mesaj: "Eroare la actualizarea fișei." });
  }
});

// Sterge o fisa (Delete)
app.delete('/api/pacienti/:id', async (req, res) => {
  try {
    await Pacient.findByIdAndDelete(req.params.id);
    res.json({ mesaj: "Pacient șters cu succes." });
  } catch (error) {
    res.status(500).json({ mesaj: "Eroare la ștergerea fișei." });
  }
});

// Legarea unui cont de pacient de fisa lui medicala (dupa CNP)
app.post('/api/link-pacient', async (req, res) => {
  try {
    const { cnp, uid } = req.body;
    const pacient = await Pacient.findOne({ cnp });
    
    if (!pacient) {
      return res.status(404).json({ mesaj: "Nu s-a găsit nicio fișă medicală cu acest CNP." });
    }

    pacient.pacientUid = uid;
    await pacient.save();
    res.status(200).json({ mesaj: "Fișă asociată contului cu succes!" });
  } catch (error) {
    res.status(500).json({ mesaj: "Eroare la legarea fișei." });
  }
});

// Pacientul isi preia fisa folosind ID-ul contului lui (uid)
app.get('/api/pacient-fisa/:uid', async (req, res) => {
  try {
    const fisa = await Pacient.findOne({ pacientUid: req.params.uid });
    if (!fisa) {
      return res.status(404).json({ mesaj: "Nu ai nicio fișă asociată încă." });
    }
    res.json(fisa);
  } catch (error) {
    res.status(500).json({ mesaj: "Eroare la preluarea fișei." });
  }
});


// ==========================================
// 5. RUTE PENTRU RECOMANDARI
// ==========================================

// Adauga o recomandare
app.post('/api/recomandari', async (req, res) => {
  try {
    const recNoua = new Recomandare(req.body);
    await recNoua.save();
    res.status(201).json({ mesaj: "Recomandare salvata!", recomandare: recNoua });
  } catch (error) {
    res.status(500).json({ mesaj: "Eroare la salvarea recomandării." });
  }
});

// Preia recomandarile unui pacient
app.get('/api/recomandari/:pacientId', async (req, res) => {
  try {
    const recomandari = await Recomandare.find({ pacientId: req.params.pacientId }).sort({ timestamp: -1 });
    res.json(recomandari);
  } catch (error) {
    res.status(500).json({ mesaj: "Eroare la preluarea recomandărilor." });
  }
});


// ==========================================
// 6. RUTE ADMINISTRATOR
// ==========================================

// Dashboard sumar pentru administrator
app.get('/api/admin/overview', async (req, res) => {
  try {
    const [
      totalUtilizatori,
      totalMedici,
      totalPacientiUser,
      totalPacientiCuFisa,
      totalMasuratori,
      alarme,
      avertizari,
      normale,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ rol: 'medic' }),
      User.countDocuments({ rol: 'pacient' }),
      Pacient.countDocuments(),
      Masuratoare.countDocuments(),
      Pacient.countDocuments({ status: 'alarm' }),
      Pacient.countDocuments({ status: 'warn' }),
      Pacient.countDocuments({ status: 'ok' }),
    ]);

    res.json({
      totalUtilizatori,
      totalMedici,
      totalPacientiUser,
      totalPacientiCuFisa,
      totalMasuratori,
      statusPacienti: { alarme, avertizari, normale },
    });
  } catch (error) {
    console.error('Eroare /api/admin/overview:', error);
    res.status(500).json({ mesaj: 'Eroare la preluarea sumarului admin.', detalii: error.message });
  }
});

// Lista utilizatorilor pentru administrator
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('-parola')
      .sort({ data_creare: -1 });
    res.json(users);
  } catch (error) {
    console.error('Eroare /api/admin/users:', error);
    res.status(500).json({ mesaj: 'Eroare la preluarea utilizatorilor.', detalii: error.message });
  }
});

// Administratorul poate schimba rolul unui utilizator
app.put('/api/admin/users/:id/role', async (req, res) => {
  try {
    const { rol } = req.body;
    const roluriPermise = ['admin', 'medic', 'pacient'];

    if (!roluriPermise.includes(rol)) {
      return res.status(400).json({ mesaj: 'Rol invalid.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { rol },
      { new: true }
    ).select('-parola');

    if (!user) {
      return res.status(404).json({ mesaj: 'Utilizatorul nu a fost găsit.' });
    }

    res.json({ mesaj: 'Rol actualizat cu succes.', utilizator: user });
  } catch (error) {
    console.error('Eroare /api/admin/users/:id/role:', error);
    res.status(500).json({ mesaj: 'Eroare la actualizarea rolului.', detalii: error.message });
  }
});

// Administratorul poate vedea toate fisele pacientilor, cu date despre medic
app.get('/api/admin/pacienti', async (req, res) => {
  try {
    const pacienti = await Pacient.find().sort({ nume: 1, prenume: 1 }).lean();
    const medici = await User.find({ rol: 'medic' }).select('nume');
    const mapMedici = new Map(medici.map((m) => [String(m._id), m.nume]));

    // Căutăm cea mai recentă măsurătoare pentru fiecare pacient, pentru a avea date LIVE
    const pacientiCuMedic = await Promise.all(pacienti.map(async (p) => {
      const ultimaMasuratoare = await Masuratoare.findOne({ id_pacient: p._id.toString() }).sort({ timestamp: -1 });

      return {
        ...p,
        medicNume: mapMedici.get(p.medicUid) || 'Necunoscut',
        puls: ultimaMasuratoare ? (ultimaMasuratoare.puls_mediu || p.puls) : p.puls,
        temperatura: ultimaMasuratoare ? (ultimaMasuratoare.temperatura_medie || p.temperatura) : p.temperatura,
      };
    }));

    res.json(pacientiCuMedic);
  } catch (error) {
    console.error('Eroare /api/admin/pacienti:', error);
    res.status(500).json({ mesaj: 'Eroare la preluarea pacienților pentru admin.', detalii: error.message });
  }
});


// ==========================================
// 7. DATE DEMO PENTRU DEZVOLTARE
// ==========================================

async function seedDevelopmentData() {
  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) {
    return;
  }

  const [adminUser, medicUser, pacientUser] = await User.create([
    {
      nume: 'Admin Demo',
      email: 'admin@demo.ro',
      parola: 'admin123',
      rol: 'admin',
    },
    {
      nume: 'Dr. Ionescu',
      email: 'medic@demo.ro',
      parola: 'medic123',
      rol: 'medic',
    },
    {
      nume: 'Maria Popescu',
      email: 'pacient@demo.ro',
      parola: 'pacient123',
      rol: 'pacient',
    },
  ]);

  const fisaPacient = await Pacient.create({
    nume: 'Popescu',
    prenume: 'Maria',
    varsta: 52,
    cnp: '2520508123456',
    telefon: '0722000000',
    email: 'pacient@demo.ro',
    strada: 'Str. Clinicii nr. 10',
    oras: 'Cluj-Napoca',
    judet: 'Cluj',
    profesie: 'Profesor',
    locMunca: 'Liceul Central',
    istoricMedical: 'Hipertensiune arteriala controlata medicamentos.',
    alergii: 'Penicilina',
    consultatiiCardiologice: 'Control efectuat in luna martie.',
    pulsMin: 60,
    pulsMax: 100,
    tempMin: 36,
    tempMax: 37.5,
    puls: 74,
    temperatura: 36.7,
    ecg: 'Normal',
    status: 'ok',
    medicUid: medicUser._id.toString(),
    pacientUid: pacientUser._id.toString(),
  });

  await Masuratoare.insertMany([
    {
      id_pacient: fisaPacient._id.toString(),
      puls_mediu: 71,
      temperatura_medie: 36.5,
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    },
    {
      id_pacient: fisaPacient._id.toString(),
      puls_mediu: 74,
      temperatura_medie: 36.7,
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
    {
      id_pacient: fisaPacient._id.toString(),
      puls_mediu: 76,
      temperatura_medie: 36.6,
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    },
  ]);

  await Recomandare.create({
    pacientId: fisaPacient._id.toString(),
    medicUid: medicUser._id.toString(),
    tip: 'Plimbare usoara',
    durata: '30 min/zi',
    indicatii: 'Ritmul trebuie sa fie moderat, fara efort intens.',
  });

  console.log('✅ Date demo create pentru admin, medic si pacient.');
  console.log('\n======================================================');
  console.log(`🔑 [ID PACIENT PENTRU MQTT]: ${fisaPacient._id.toString()}`);
  console.log('Folosiți acest ID în MQTT Explorer la "id_pacient" !');
  console.log('======================================================\n');
}

// ==========================================
// START SERVER
// ==========================================
async function startServer() {
  try {
    const databaseMode = await connectToDatabase();

    if (databaseMode === 'memory') {
      await seedDevelopmentData();
    }

    // ==========================================
    // 8. INTEGRARE MQTT BROKER
    // ==========================================

    // Folosim un broker public gratuit pentru testare.
    // Pentru producție, îți poți face cont pe HiveMQ Cloud (gratuit) și pui aici URL-ul lor.
    
    // const mqttBrokerUrl = 'mqtt://test.mosquitto.org';
    const mqttBrokerUrl = 'mqtt://broker.hivemq.com';
    
    const mqttClient = mqtt.connect(mqttBrokerUrl);

    mqttClient.on('connect', () => {
      console.log(`📡 Conectat la brokerul MQTT: ${mqttBrokerUrl}`);
      // Ne abonăm la topicul pe care senzorii hardware vor trimite datele
      mqttClient.subscribe('sanatate/senzori/date', (err) => {
        if (err) console.error('❌ Eroare la abonare MQTT:', err);
        else console.log('📡 Abonat cu succes la topicul "sanatate/senzori/date"');
      });
    });

    mqttClient.on('message', async (topic, message) => {
      try {
        // Convertim mesajul (care vine ca Buffer/bytes) în format JSON (text)
        const dateSenzor = JSON.parse(message.toString());
        console.log(`📥 [MQTT] Date primite pe ${topic}:`, dateSenzor);

        // Salvăm datele în baza de date MongoDB (folosind Modelul tău "Masuratoare")
        const masuratoareNoua = new Masuratoare(dateSenzor);
        await masuratoareNoua.save();
        console.log('✅ [MQTT] Date salvate în baza de date cu succes!');
      } catch (error) {
        console.error('❌ [MQTT] Eroare la procesarea datelor:', error.message);
      }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Serverul rulează perfect pe portul ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Nu s-a putut porni serverul:', error);
    process.exit(1);
  }
}

startServer();