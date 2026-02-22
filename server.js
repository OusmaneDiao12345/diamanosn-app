const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'diamano.db');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// ⚙️ CONFIGURATION SENE-PAY (INTEGRATION)
// ==========================================
const SENEPAY_CONFIG = {
    // Clés fournies
    apiKey: 'pk_live_006ad6076e9081cea5dceeb1d61d60124ec995a75a380945', 
    apiSecret: 'sk_live_fdde37f876f68b1cdc27ea590ea5ffc3cb36caa597f22fad',
    baseUrl: 'https://api.sene-pay.com/api/v1' 
};

// Connexion à la Base de Données SQLite
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Erreur ouverture base de données', err.message);
    } else {
        console.log('Connecté à la base de données SQLite.');
        initDb();
    }
});

// Initialisation des Tables
function initDb() {
    db.serialize(() => {
        // Table Produits
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            cat TEXT,
            brand TEXT,
            price INTEGER,
            oldPrice INTEGER,
            rating REAL,
            reviews INTEGER,
            image TEXT,
            badge TEXT,
            desc TEXT,
            tags TEXT
        )`);

        // Table Utilisateurs
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            phone TEXT UNIQUE,
            email TEXT,
            password TEXT
        )`);

        // Table Commandes
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ref TEXT,
            userId INTEGER,
            clientName TEXT,
            total TEXT,
            status TEXT,
            date TEXT,
            items TEXT,
            payment TEXT,
            address TEXT
        )`);

        // Vérifier si produits existent, sinon les créer (Seed)
        db.get("SELECT count(*) as count FROM products", (err, row) => {
            if (row && row.count === 0) {
                console.log("Initialisation des produits...");
                seedProducts();
            } else {
                console.log(`Base de données chargée : ${row.count} produits existants.`);
            }
        });
    });
}

// Données initiales (basées sur votre HTML actuel)
const initialProducts = [
  {id:1,name:'Samsung Galaxy A54 5G 128Go',cat:'Électronique',brand:'Samsung',price:189000,oldPrice:239000,rating:4.5,reviews:284,image:'https://i.roamcdn.net/hz/ed/listing-gallery-full-1920w/acd777160bac6c8b22024453025cdef0/-/horizon-files-prod/ed/picture/qxjgj2qz/2ff87a27a8281733562188a0a523ae0604c80efb.jpg',badge:'hot',desc:'Écran 6.4" AMOLED 120Hz, 128Go, 5000mAh, Android 14. Garantie 1 an.',tags:'Smartphone,5G,Samsung'},
  {id:2,name:'Tecno Spark 40 Pro 256Go',cat:'Électronique',brand:'Tecno',price:89000,oldPrice:110000,rating:4.3,reviews:412,image:'https://sn.jumia.is/unsafe/fit-in/500x500/filters:fill(white)/product/12/900721/1.jpg?7064',badge:'hot',desc:'Écran 6.78" FHD+, 256Go stockage, 5000mAh, Android 13.',tags:'Smartphone,Tecno'},
  {id:3,name:'iPhone 14 128Go',cat:'Électronique',brand:'Apple',price:585000,oldPrice:650000,rating:4.8,reviews:156,image:'https://parisdakarshopping.com/sites/default/files/styles/uc_product_full/public/2022-09/611mRs-imxL._AC_SL1500_.jpg?itok=NRfjdoar',badge:'top',desc:'A15 Bionic, double appareil 12MP, iOS 17.',tags:'Smartphone,Apple,iOS'},
  {id:4,name:'TV Samsung 43" 4K Smart',cat:'Électronique',brand:'Samsung',price:249000,oldPrice:320000,rating:4.6,reviews:89,image:'https://sn.jumia.is/unsafe/fit-in/500x500/filters:fill(white)/product/22/766121/1.jpg?9195',badge:'sale',desc:'4K Crystal UHD, HDR, Smart TV Tizen, Wi-Fi. Garantie 2 ans.',tags:'TV,Samsung,4K'},
  {id:5,name:'Itel A70 64Go Dual SIM',cat:'Électronique',brand:'Itel',price:45000,oldPrice:55000,rating:4.2,reviews:634,image:'https://zoom.com.tn/60414-large_default/smartphone-itel-a70-4go-64-go-double-sim-noir-a665l.jpg',badge:'new',desc:'6.6" écran, 64Go, Android 13 Go Edition.',tags:'Smartphone,Itel'},
  {id:6,name:'Clé 4G Huawei E3372',cat:'Électronique',brand:'Huawei',price:28000,oldPrice:35000,rating:4.4,reviews:203,image:'https://m.media-amazon.com/images/I/41o9FGXkvyS.jpg',badge:'sale',desc:'Clé 4G LTE 150Mbps, compatible tous opérateurs Sénégal.',tags:'4G,Internet,Huawei'},
  {id:7,name:'Boubou Grand Bazin Brodé Homme',cat:'Mode',brand:'Atelier Dakar',price:38000,oldPrice:50000,rating:4.9,reviews:342,image:'https://afro-elegance.com/cdn/shop/files/hommes-royal-bleu-dashiki-blanc-geometrique-broderie.webp?v=1756117480',badge:'hot',desc:'Grand Bazin brodé, qualité supérieure, taille S-XXL.',tags:'Boubou,Traditionnel,Homme'},
  {id:8,name:'Robe Wax Bogolan Femme',cat:'Mode',brand:'Mode Africaine SN',price:18500,oldPrice:25000,rating:4.7,reviews:512,image:'https://kaysolcouture.fr/cdn/shop/files/IMG_8656.jpg?v=1722855919&width=990',badge:'sale',desc:'Tissu wax bogolan authentique, coupe moderne 2024.',tags:'Wax,Femme,Robe'},
  {id:9,name:'Babouches Cuir Artisanal Dakar',cat:'Mode',brand:'Maroquinerie Dakar',price:12000,oldPrice:16000,rating:4.6,reviews:287,image:'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDaPcRAnfy1L1fJ1FnOEEFiKHm3dPjoYMexA&s',badge:'top',desc:'Cuir véritable tannerie Dakar, confort & durabilité. Fait main.',tags:'Chaussures,Cuir,Artisanat'},
  {id:10,name:'Adidas Ultraboost 22 Running',cat:'Mode',brand:'Adidas',price:65000,oldPrice:85000,rating:4.8,reviews:145,image:'https://runners.ae/cdn/shop/products/ADIDAS-ULTRABOOST-22-FOR-MEN-LEGEND-INK-GX6642_5.jpg?v=1662712628',badge:'sale',desc:'Chaussures running premium, technologie Boost.',tags:'Sport,Adidas,Running'},
  {id:11,name:'Riz Brisé Extra SAED 50kg',cat:'Alimentation',brand:'SAED',price:22000,oldPrice:27000,rating:4.9,reviews:820,image:'https://www.senboutique.com/images/products/detail_113_riz_umbrella-25kg.jpg',badge:'top',desc:'Riz brisé qualité extra, idéal thiébou dieun. Production locale.',tags:'Riz,Local,Cuisine'},
  {id:12,name:"Huile d'Arachide Lesieur 5L",cat:'Alimentation',brand:'Lesieur',price:8500,oldPrice:10500,rating:4.8,reviews:634,image:'https://sakanal.sn/10488-large_default/huile-lessieur-5l.jpg',badge:'hot',desc:"Huile pure qualité supérieure, 100% arachide, origine Sénégal.",tags:'Huile,Cuisine,Local'},
  {id:13,name:'Café Touba Premium 500g',cat:'Alimentation',brand:'Touba Coffee',price:4500,oldPrice:5500,rating:4.9,reviews:756,image:'https://sn.jumia.is/unsafe/fit-in/500x500/filters:fill(white)/product/86/946321/1.jpg?9642',badge:'top',desc:'Café Touba authentique, sélection djar et karité.',tags:'Café,Touba,Local'},
  {id:14,name:'Kit Épices Thiébou Dieun',cat:'Alimentation',brand:'Saveurs du Sénégal',price:7500,oldPrice:9000,rating:4.7,reviews:412,image:'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRm5kIJSnVAj8y1kZ7Paevy2XhSXT-g1NHAAEJcild2KIo_pO7O1CcV79__C29_dXxVOhg&usqp=CAU',badge:'new',desc:'Kit épices : tomate séchée, céleri, ail, guedj, nététu. 100% naturel.',tags:'Épices,Cuisine,Local'},
  {id:15,name:'Ventilateur sur Pied Tornado 18"',cat:'Maison & Déco',brand:'Tornado',price:22000,oldPrice:28000,rating:4.4,reviews:345,image:'https://sn.jumia.is/unsafe/fit-in/500x500/filters:fill(white)/product/93/658121/1.jpg?8780',badge:'sale',desc:'3 vitesses, oscillation 90°, silencieux, colonne réglable.',tags:'Ventilateur,Électroménager'},
  {id:16,name:'Climatiseur Haier 12000 BTU Split',cat:'Maison & Déco',brand:'Haier',price:245000,oldPrice:265000,rating:4.6,reviews:78,image:'https://sn.jumia.is/unsafe/fit-in/500x500/filters:fill(white)/product/83/709621/1.jpg?3359',badge:'hot',desc:'Clim split 12000 BTU, Inverter A++, télécommande. Installation comprise à Dakar.',tags:'Climatiseur,Électroménager'},
  {id:17,name:'Matelas Simmons Conjugué 140x190',cat:'Maison & Déco',brand:'Simmons',price:145000,oldPrice:195000,rating:4.7,reviews:112,image:'https://www.direct-matelas.fr/8059-home_default/pack-140x190-matelas-simmons-sensoft-dos-sensible-sommier-dm-solux-tapissier-lattes-pieds-de-lit-cylindriques.jpg',badge:'sale',desc:'Matelas mousse mémoire de forme 20cm, garantie 5 ans.',tags:'Matelas,Chambre,Premium'},
  {id:18,name:'Beurre de Karité Pur 500ml',cat:'Beauté',brand:'Karité Sénégal',price:4800,oldPrice:6500,rating:4.9,reviews:923,image:'https://sn.jumia.is/unsafe/fit-in/500x500/filters:fill(white)/product/94/62906/1.jpg?3806',badge:'top',desc:'Karité 100% naturel non raffiné bio, hydratant intense.',tags:'Karité,Naturel,Bio'},
  {id:19,name:'Savon Noir Beldi Artisanal',cat:'Beauté',brand:'Hammam Dakar',price:3200,oldPrice:4500,rating:4.7,reviews:456,image:'https://i.pinimg.com/736x/89/21/03/8921033383b6624ba0fe909373011198.jpg',badge:'new',desc:'Savon noir artisanal à huile olive, gommage naturel puissant.',tags:'Savon,Naturel,Artisanat'},
  {id:20,name:'Ballon Football Nike Strike',cat:'Sport',brand:'Nike',price:25000,oldPrice:35000,rating:4.6,reviews:234,image:'https://thumblr.uniid.it/product/150370/87646ba20337.jpg?width=3840&format=webp&q=75',badge:'sale',desc:'Ballon officiel FIFA Quality, taille 5.',tags:'Football,Ballon,Nike'},
  {id:21,name:'Tapis de Yoga 8mm + Sangle',cat:'Sport',brand:'Décathlon',price:15000,oldPrice:20000,rating:4.5,reviews:167,image:'https://sn.jumia.is/unsafe/fit-in/500x500/filters:fill(white)/product/05/528221/1.jpg?7614',badge:'new',desc:'Tapis yoga 8mm, antidérapant double face, avec sangle.',tags:'Yoga,Sport,Bien-être'},
  {id:22,name:'Batterie Voiture Exide 60Ah',cat:'Auto & Moto',brand:'Exide',price:42000,oldPrice:55000,rating:4.5,reviews:143,image:'https://m.media-amazon.com/images/I/81VS3NNH3ML._AC_UF1000,1000_QL80_.jpg',badge:'sale',desc:'Batterie 60Ah longue durée, garantie 2 ans. Livraison & pose Dakar.',tags:'Batterie,Auto,Garantie'},
  {id:23,name:'Couches Pampers Premium L x60',cat:'Bébé & Jouets',brand:'Pampers',price:12500,oldPrice:15000,rating:4.8,reviews:567,image:'https://sn.jumia.is/unsafe/fit-in/500x500/filters:fill(white)/product/18/946721/1.jpg?5135',badge:'hot',desc:'Couches ultra-absorbantes, taille L (9-14kg). Peaux sensibles.',tags:'Couches,Bébé,Pampers'},
  {id:24,name:'Poussette Bébé Confort Lara',cat:'Bébé & Jouets',brand:'Bébé Confort',price:78000,oldPrice:99000,rating:4.8,reviews:67,image:'https://sn.jumia.is/unsafe/fit-in/500x500/filters:fill(white)/product/25/46489/1.jpg?0898',badge:'sale',desc:'Poussette pliable ultraléger, nacelle + siège, naissance à 15kg.',tags:'Poussette,Bébé'}
];

function seedProducts() {
    const stmt = db.prepare("INSERT INTO products (name, cat, brand, price, oldPrice, rating, reviews, image, badge, desc, tags) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
    initialProducts.forEach(p => {
        stmt.run(p.name, p.cat, p.brand, p.price, p.oldPrice, p.rating, p.reviews, p.image, p.badge, p.desc, p.tags);
    });
    stmt.finalize();
}

// ==================== API ROUTES ====================

app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(500).json({error: err.message});
        const products = rows.map(p => ({
            ...p,
            tags: p.tags ? p.tags.split(',') : [],
            old: p.oldPrice 
        }));
        res.json(products);
    });
});

app.post('/api/register', async (req, res) => {
    const { name, phone, email, password } = req.body;
    if (!password || password.length < 6) {
        return res.status(400).json({ error: "Le mot de passe doit faire au moins 6 caractères." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // 10 = "salt rounds", une bonne valeur par défaut
        db.run(`INSERT INTO users (name, phone, email, password) VALUES (?,?,?,?)`, 
        [name, phone, email, hashedPassword], function(err) {
            if (err) {
                return res.status(400).json({ error: "Ce numéro ou email existe déjà." });
            }
            res.status(201).json({ id: this.lastID, name, phone, email });
        });
    } catch (e) {
        res.status(500).json({ error: "Erreur lors de la création du compte." });
    }
});

app.post('/api/login', (req, res) => {
    const { id, password } = req.body;
    // 1. On cherche l'utilisateur par son identifiant (téléphone ou email)
    db.get("SELECT * FROM users WHERE phone = ? OR email = ?", [id, id], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });

        // 2. Si l'utilisateur existe, on compare le mot de passe fourni avec le hash en base de données
        if (user && (await bcrypt.compare(password, user.password))) {
            res.json({ id: user.id, name: user.name, phone: user.phone, email: user.email });
        } else {
            // Si l'utilisateur n'existe pas ou si le mot de passe est faux, on renvoie la même erreur
            res.status(401).json({ error: "Identifiants incorrects" });
        }
    });
});

app.post('/api/orders', (req, res) => {
    const { ref, userId, clientName, total, status, date, items, payment, address } = req.body;
    const itemsStr = JSON.stringify(items);
    db.run(`INSERT INTO orders (ref, userId, clientName, total, status, date, items, payment, address) VALUES (?,?,?,?,?,?,?,?,?)`,
    [ref, userId, clientName, total, status, date, itemsStr, payment, address], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Commande enregistrée", orderId: this.lastID });
    });
});

// 5. Initier un paiement SenePay
app.post('/api/payment/initiate', async (req, res) => {
    console.log("\n=================================");
    console.log("📨 NOUVELLE DEMANDE DE PAIEMENT");
    
    // ✅ FIX 1: Forcer integer strict (SenePay rejette les floats)
    const amount = Math.round(Math.max(200, Number(req.body.amount) || 200));
    
    // ✅ FIX 2: Téléphone fallback (SenePay exige un numéro valide avec 221)
    const rawPhone = req.body.customerPhone || '';
    let customerPhone = String(rawPhone).replace(/\D/g, '');
    if (customerPhone.startsWith('00221')) customerPhone = customerPhone.slice(2);
    if (!customerPhone.startsWith('221')) customerPhone = '221' + customerPhone;
    if (customerPhone.length < 12) customerPhone = '221770000000';
    
    // ✅ FIX 3: Gestion URL (SenePay rejette 127.0.0.1, utiliser localhost)
    let returnUrl = req.body.returnUrl || 'http://localhost:3000';
    returnUrl = returnUrl.replace('127.0.0.1', 'localhost');
    // En production, utiliser l'URL réelle du site
    if (returnUrl.includes('localhost') || returnUrl.includes('127.0.0.1')) {
        returnUrl = 'http://localhost:3000';
    }

    console.log(`👤 Client   : ${req.body.customerName}`);
    console.log(`📱 Téléphone: ${customerPhone}`);
    console.log(`💰 Montant  : ${amount} FCFA (XOF)`);
    console.log(`🔗 ReturnUrl: ${returnUrl}`);

    // ✅ FIX 4: Payload exact conforme à la doc SenePay
    const orderRef = "DIA-" + Date.now();
    const payload = {
        amount: amount,
        currency: "XOF",
        orderId: orderRef,
        customerName: req.body.customerName || "Client",
        customerPhone: customerPhone,
        returnUrl: returnUrl,
        metadata: {
            description: "Commande DiamanoSN"
        }
    };

    console.log("📤 Payload envoyé:", JSON.stringify(payload, null, 2));

    try {
        const response = await axios.post(
            `${SENEPAY_CONFIG.baseUrl}/payments/initiate`,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Api-Key': SENEPAY_CONFIG.apiKey,
                    'X-Api-Secret': SENEPAY_CONFIG.apiSecret
                },
                timeout: 15000 // 15s timeout
            }
        );

        console.log("📥 Réponse SenePay:", JSON.stringify(response.data, null, 2));
        
        // ✅ FIX 5: Chercher redirectUrl dans plusieurs champs possibles
        const d = response.data?.data || {};
        const redirectUrl = d.redirectUrl;

        if (redirectUrl) {
            console.log("✅ SUCCÈS ! URL:", redirectUrl);
            res.json({ success: true, redirectUrl, token: d.tokenPay });
        } else {
            console.warn("⚠️ Réponse OK mais pas de redirectUrl. Réponse complète:", response.data);
            res.status(502).json({ 
                success: false, 
                message: "SenePay a répondu mais sans lien de paiement. Vérifiez la configuration.",
                raw: response.data 
            });
        }

    } catch (error) {
        console.error("❌ ÉCHEC PAIEMENT SENEPAY");
        
        if (error.response) {
            // L'API a répondu avec une erreur HTTP
            const status = error.response.status;
            const body = error.response.data;
            console.error(`🔴 HTTP ${status}:`, JSON.stringify(body, null, 2));
            
            // Messages d'erreur lisibles selon le code
            let userMessage = "Erreur du service de paiement.";
            
            // Détection spécifique de l'erreur "Application non approuvée"
            if (JSON.stringify(body).includes("Application non approuvée")) {
                console.error("\n⚠️  DIAGNOSTIC : Vos clés API sont valides, mais le compte marchand SenePay/MoneyFusion n'est pas approuvé pour les transactions.");
                console.error("👉 Solution : Contactez le support SenePay pour activer votre compte ou vérifiez que vous n'utilisez pas des clés de test sur l'URL de production.\n");
                userMessage = "Compte SenePay non activé ou non approuvé (Erreur MoneyFusion).";
            }
            else if (status === 401) userMessage = "Clés API SenePay invalides. Vérifiez apiKey et apiSecret.";
            else if (status === 422) userMessage = "Données invalides envoyées à SenePay : " + (body?.message || JSON.stringify(body));
            else if (status === 400) userMessage = "Requête rejetée par SenePay : " + (body?.message || body?.error || JSON.stringify(body));
            else if (status === 403) userMessage = "Accès refusé SenePay. Compte peut-être en mode test ou suspendu.";
            else if (status === 429) userMessage = "Trop de requêtes SenePay. Attendez quelques secondes.";
            else if (status >= 500) userMessage = "Erreur interne SenePay. Réessayez dans quelques instants.";
            
            res.status(status).json({ success: false, message: userMessage, details: body });
        } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            console.error("🔴 Timeout :", error.message);
            res.status(504).json({ success: false, message: "SenePay ne répond pas (timeout 15s). Réessayez." });
        } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
            console.error("🔴 DNS/Réseau :", error.message);
            res.status(503).json({ success: false, message: "Impossible d'atteindre SenePay. Vérifiez votre connexion internet." });
        } else {
            console.error("🔴 Erreur inconnue :", error.message);
            res.status(500).json({ success: false, message: "Erreur inattendue : " + error.message });
        }
    }
});

// 6. Vérifier le statut du paiement
app.get('/api/payment/status/:token', async (req, res) => {
    try {
        const response = await axios.get(`${SENEPAY_CONFIG.baseUrl}/payments/${req.params.token}/status`, {
            headers: { 'X-Api-Key': SENEPAY_CONFIG.apiKey, 'X-Api-Secret': SENEPAY_CONFIG.apiSecret }
        });
        res.json({ success: true, data: response.data.data || response.data });
    } catch (error) {
        res.status(500).json({ success: false, message: "Impossible de vérifier le statut" });
    }
});

app.listen(PORT, () => {
    console.log(`Serveur DiamanoSN démarré sur http://localhost:${PORT}`);
});