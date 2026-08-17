# Tulipano Nero — App gestionale del salone

*Realizzata da Simone Li Sacchi, con l'aiuto di Claude (Anthropic). 🌷*

App installabile su tablet/smartphone che funziona **anche senza internet** e si sincronizza
con un foglio Google quando la connessione torna disponibile.

Contiene 3 sezioni: **Scheda Clienti**, **Agenda** (nuova) e **Magazzino** (con avviso scorta minima, nuovo).

---

## Parte 1 — Collegare l'app a Google Sheets (da fare una sola volta, da PC)

### Passo 1: crea il foglio Google
1. Vai su [sheets.google.com](https://sheets.google.com) e crea un foglio nuovo, vuoto.
2. Chiamalo per esempio "Tulipano Nero — Dati". Non serve creare le colonne a mano: le crea l'app da sola al primo utilizzo.

### Passo 2: incolla lo script e imposta la tua chiave
1. Nel foglio, vai su **Estensioni → Apps Script**.
2. Cancella tutto il codice di esempio che trovi già scritto.
3. Apri il file `google-apps-script/Code.gs` (incluso in questa cartella), copia tutto il contenuto e incollalo al posto del codice cancellato.
4. Vicino all'inizio del file trovi `const SYNC_SECRET_ATTESA = 'INSERISCI-QUI-UNA-CHIAVE-LUNGA-E-CASUALE-TUTTA-TUA';`. Sostituisci il testo tra virgolette con una chiave lunga e casuale tutta tua — per esempio generata su [1password.com/password-generator](https://1password.com/password-generator) (va benissimo anche molto lunga, tipo 40 caratteri). Questa chiave **non va mai copiata nei file dell'app** (quelli che carichi su GitHub, quindi pubblici): resta solo qui e la incollerai più avanti direttamente sul tablet, dalle Impostazioni.
5. Salva (icona del dischetto, o Ctrl+S).

> Se il progetto era già stato pubblicato in passato con la chiave di esempio inclusa nei file dell'app (versioni precedenti la mettevano anche in `js/sync.js`), quella chiave è da considerare compromessa: usane una nuova, non riprendere quella vecchia.

### Passo 3: pubblica lo script come "app web"
1. In alto a destra clicca **Esegui il deployment → Nuovo deployment**.
2. Clicca l'icona a forma di ingranaggio accanto a "Seleziona tipo" e scegli **App web**.
3. Imposta:
   - **Esegui come**: Io (il tuo account)
   - **Chi può accedere**: Chiunque
4. Clicca **Esegui il deployment**.
5. Google ti chiederà di autorizzare lo script (è normale, è il tuo stesso script): segui i passaggi, clicca "Avanzate" se compare un avviso di sicurezza e poi "Vai alla pagina (non sicura)" — è sicuro perché il codice è quello che hai appena incollato tu.
6. Copia l'**URL dell'app web** che ti viene mostrato (inizia con `https://script.google.com/macros/s/....../exec`). Ti servirà tra un minuto.

> Se in futuro modifichi lo script, dovrai fare "Gestisci deployment" → matita ✏️ → "Nuova versione" → Esegui il deployment, altrimenti le modifiche non si attivano.

---

## Parte 2 — Installare l'app sul tablet

L'app è fatta di semplici file (HTML/CSS/JS): per essere installabile e funzionare offline
deve essere "servita" da un indirizzo web, non aperta come file. Il modo più semplice e **gratuito**:

### Opzione consigliata: GitHub Pages
1. Crea un account gratuito su [github.com](https://github.com) (se non lo hai già).
2. Crea un nuovo repository (es. "tulipano-nero-app") e carica dentro tutti i file di questa cartella (index.html, manifest.json, sw.js, css/, js/, icons/) mantenendo la stessa struttura.
3. Vai nelle **Impostazioni** del repository → **Pages** → in "Source" scegli il branch principale, cartella `/ (root)` → Salva.
4. Dopo qualche minuto GitHub ti darà un indirizzo tipo `https://tuonome.github.io/tulipano-nero-app/`.

### In alternativa
Qualsiasi hosting statico gratuito va bene (Netlify, Vercel, Cloudflare Pages): basta trascinare la cartella nel loro pannello.

### Installazione sul tablet
1. Apri quell'indirizzo con il browser del tablet (Chrome consigliato).
2. Apri il menu del browser (⋮) e scegli **"Aggiungi a schermata Home"** o **"Installa app"**.
3. Da ora l'icona del tulipano nero comparirà come un'app vera, a schermo intero.

---

## Parte 3 — Collegare l'app al foglio Google

1. Apri l'app sul tablet, tocca l'icona ⚙ **Impostazioni** in alto a destra.
2. Nella sezione "Sincronizzazione" tocca **Modifica indirizzo** per sbloccare i campi (sono protetti da tocchi accidentali, quindi restano nascosti finché non li apri apposta).
3. Incolla l'**indirizzo** copiato al Passo 3 della Parte 1 (quello che finisce in `/exec`) e la **chiave** che hai scelto al Passo 2 (deve essere identica, carattere per carattere, a quella scritta in `SYNC_SECRET_ATTESA` dentro Code.gs).
4. Tocca **Salva indirizzo**. L'app farà subito una prima sincronizzazione.
5. Ripeti gli stessi passaggi sul secondo dispositivo (quello di Mary): la chiave va incollata su ciascun dispositivo separatamente, non si sincronizza da sola (è proprio il punto: non passa mai dal codice pubblico).

Da questo momento:
- Ogni modifica fatta sul tablet (anche offline) viene salvata subito in locale e inviata al foglio Google appena torna la connessione.
- Il pallino in alto mostra se sei **Online/Offline** e lo stato della sincronizzazione.
- Puoi anche forzare una sincronizzazione manuale da Impostazioni → "Sincronizza ora".

---

## Parte 4 — Attivare la pulizia automatica degli appuntamenti vecchi (facoltativa, consigliata)

Per non far crescere il foglio Google all'infinito, lo script può cancellare da solo, ogni notte,
gli appuntamenti con più di 3 mesi (es. se oggi è agosto, il 3 di ogni notte elimina tutto ciò
che è prima di maggio). Non tocca mai Clienti e Magazzino, solo l'Agenda.

Va attivata una sola volta:

1. Torna su **Estensioni → Apps Script** nel foglio Google (stesso posto della Parte 1).
2. In alto, dove c'è il menu a tendina delle funzioni, scegli **creaTriggerPuliziaAutomatica**.
3. Clicca **Esegui** (▶). Al primo avvio potrebbe richiedere di nuovo l'autorizzazione: accettala come prima.
4. Fatto. Da questo momento la pulizia gira da sola ogni notte, anche a tablet spento — non serve rifare nulla.

Per controllare che sia attiva, o per disattivarla in futuro, vai su **Trigger** (l'icona a forma di sveglia
nel menu a sinistra di Apps Script): vedrai una riga con "pulisciAppuntamentiVecchi".

---

## Parte 4bis — Correggere un problema noto: Google Sheets che trasforma nomi in date

**Sintomo**: un nome cliente o prodotto che assomiglia a una data o a un codice numerico (es.
un codice colore tipo "8/3" o "8/4") appare stranamente cambiato in una data completa (tipo
"2026-08-04T22:00:00.000Z") — sia nel foglio Google che nell'app. Non è un errore di battitura
né un difetto dei dati: è Google Sheets che, in totale autonomia, interpreta quel testo come se
fosse una data e lo converte — capita anche quando il valore arriva da uno script, non solo
scrivendolo a mano nella cella.

**Se hai già aggiornato `Code.gs`** con la versione più recente di questo file (contiene già la
correzione), va attivata una volta sola sul foglio esistente:

1. Torna su **Estensioni → Apps Script** nel foglio Google.
2. Dal menu a tendina delle funzioni in alto, scegli **correggiFormatoColonne**.
3. Clicca **Esegui** (▶). Da questo momento le colonne di testo libero (nomi, categorie, note,
   orari, ecc.) non verranno più trasformate da sole in date o numeri.

**Attenzione**: questo corregge il formato per le scritture *future*, ma non può recuperare un
testo già trasformato in data in passato (quel testo non esiste più: Google Sheets ha tenuto
solo la data). Dopo aver eseguito la funzione, ricontrolla a occhio le colonne "nome" di
Clienti e Magazzino per eventuali valori ancora sbagliati, e correggili **dall'app stessa**
(Modifica → riscrivi il nome giusto → Salva): da questo momento in poi resterà testo, non verrà
più convertito.

### Un secondo problema noto, collegato al primo: righe duplicate

**Sintomo**: la stessa riga (stesso id, stessi dati) compare due volte in uno dei fogli.
Succedeva quando due sincronizzazioni partivano quasi nello stesso istante (es. un tentativo
automatico in sottofondo che si sovrapponeva a uno manuale): entrambe controllavano se la riga
esisteva già nello stesso momento, non se la vedevano a vicenda, e la creavano ciascuna per
conto proprio invece che una sola aggiornasse quella esistente.

`Code.gs` più recente lo evita alla radice (fa aspettare la seconda sincronizzazione finché la
prima non ha finito di scrivere). Per **ripulire i duplicati già creati in passato**:

1. Su Apps Script, dal menu a tendina delle funzioni scegli **rimuoviRigheDuplicate**.
2. Clicca **Esegui** (▶). Per ogni id ripetuto, tiene solo la riga più recente ed elimina le
   altre — su tutti e tre i fogli in un colpo solo.

### Un terzo problema noto: cancellare una riga direttamente dal foglio non si vedeva sull'app

**Sintomo**: cancellando una riga a mano dal foglio Google (tasto destro → elimina riga), quel
cliente/prodotto/appuntamento restava visibile sul tablet anche dopo aver sincronizzato.

Il motivo: quando l'app stessa cancella qualcosa, non toglie subito la riga dal foglio — la
marca come "eliminato" (colonna `eliminato` = TRUE), così anche gli altri dispositivi si
accorgono che va tolta (vedi "Note utili" più in basso). Cancellando invece una riga a mano
dal foglio, questa sparisce e basta: non lascia nessuna traccia di "questo è stato eliminato"
per gli altri dispositivi, quindi la sincronizzazione — che guarda solo cosa è *cambiato* di
recente — non se ne accorgeva.

`Code.gs` più recente lo risolve: ora ogni sincronizzazione confronta anche l'elenco completo
di cosa è ancora presente sul foglio con quello che c'è sul tablet, e toglie in locale quello
che non trova più. Non serve nessuna funzione da eseguire per questa correzione: basta aver
ricaricato e ridistribuito `Code.gs` come sopra — dalla sincronizzazione successiva funziona
già così su tutti i dispositivi.

> **Consiglio**: resta comunque preferibile cancellare da dentro l'app quando possibile
> (tocca l'elemento → Elimina), così la cronologia di chi/quando resta più chiara. Cancellare
> direttamente dal foglio ora funziona correttamente, ma è un'operazione "distruttiva" senza
> possibilità di annullamento, mentre dentro l'app resta comunque tracciata.

---

## Parte 5 — Nessun accesso richiesto: come restano protetti i dati

Aprendo l'app compare solo per un attimo il logo, poi si entra direttamente in **Scheda
Clienti** — nessun nome da toccare, nessun codice da ricordare. È stata una scelta
esplicita: dopo aver provato diversi sistemi di accesso (Google, email e password, codice
a 6 cifre), è risultato più fonte di problemi che di reale protezione per un uso familiare
come questo, e lo abbiamo tolto.

**Cosa protegge davvero i dati**, quindi, è solo la **chiave di sincronizzazione** (vedi
Parte 1, Passo 2): quella sì resta necessaria, e senza di essa non si può né leggere né
scrivere nulla sul foglio Google. È completamente separata da "chi può aprire l'app sul
tablet" — ed è proprio per questo che è lei, e non un login, il punto giusto dove mettere
la protezione: una chiave lunga e casuale che tu scegli, mai scritta nei file pubblici
dell'app, non un codice che qualcuno deve ricordare ogni giorno.

**Cosa comporta in pratica**: chiunque abbia il link dell'app (o metta le mani sul tablet
mentre è acceso) può aprirla ed entrare direttamente, vedendo nomi, contatti e note dei
clienti. Per questo:
- **Non condividere né pubblicare da nessuna parte** il link dell'app.
- Tratta il tablet come tratteresti un registro cartaceo dei clienti: non lasciarlo incustodito con estranei nei paraggi.

Se in futuro cambiassi idea e volessi rimettere un accesso (più semplice di prima, se
vuoi), fammelo sapere.

---

## Risoluzione problemi — "ho aggiornato ma non vedo le modifiche"

L'app funziona offline salvando una copia di sé stessa sul dispositivo (è il punto di forza,
ma può avere un effetto collaterale): a volte, dopo un aggiornamento, il tablet resta
"aggrappato" alla copia vecchia anche se sul server è già cambiato tutto. Se dopo aver
ricaricato i file su GitHub non vedi le novità (o noti comportamenti strani tipo scroll
bloccato o sincronizzazione che non parte), risolvi così:

1. Se l'app è installata come icona, disinstallala dalla schermata Home (i tuoi dati restano
   salvati sul foglio Google, non sull'icona: nessun rischio).
2. Apri Chrome normale → menu ⋮ → Impostazioni → Impostazioni sito → Tutti i siti → trova il
   tuo indirizzo (es. `tuonomeutente.github.io`) → **"Elimina e reimposta"** ("Clear & reset").
3. Riapri il link dell'app in Chrome: vedrai per un attimo il logo, poi si entra
   direttamente in Scheda Clienti — a questo punto l'app scarica tutto da zero, versione
   più recente compresa.
4. Reinstalla l'icona sulla Home se vuoi (menu ⋮ → Installa app).

Questo "azzera" completamente qualunque cosa il tablet avesse salvato in cache per quel sito,
quindi funziona sempre, qualunque sia la causa esatta del blocco.

---

## Note utili

- **Selezione multipla dei servizi**: nel modulo "Nuovo appuntamento" puoi scegliere più servizi insieme (es. Taglio + Piega) toccando più chip: la durata totale si somma automaticamente, restando comunque modificabile a mano.
- **Listino Prezzi**: nelle Impostazioni i prezzi sono mostrati bloccati (sola lettura), per evitare di cambiarli per sbaglio scorrendo la schermata; tocca "Modifica prezzi" per sbloccarli, poi ogni prezzo si tocca e si riscrive (le modifiche restano salvate sul tablet). Usa "Stampa listino" per stamparlo — non serve nessun file PDF a parte. Le durate usate in Agenda restano invece definite in `js/listino.js`.
- **Indirizzo di sincronizzazione**: nelle Impostazioni è mostrato come "Configurata/Non configurata" e non è modificabile a colpo d'occhio; tocca "Modifica indirizzo" per aprirlo e cambiarlo. Anche questo per evitare di toccarlo o cancellarlo per sbaglio.
- **Pannello "Diagnostica"**: in fondo alle Impostazioni mostra informazioni tecniche sul tablet che hai in mano (versione dell'app, stato della sincronizzazione ed eventuali errori, quanti dati sono salvati e quanti ancora da sincronizzare, spazio occupato). Include anche "Forza risincronizzazione completa" (se un tablet sembra disallineato, riscarica tutto da zero dal foglio Google) e "Copia diagnostica" (copia tutto come testo). Utile soprattutto a te per un controllo veloce; Mary può ignorarlo tranquillamente.
- **Giorni di chiusura**: domenica e lunedì sono considerati chiusi di default, evidenziati con un motivo a righe sia in vista mese sia in vista giorno — non serve segnarli a mano. In Agenda → "Vedi mese" → tocca "Ferie" per attivare la modalità di modifica (il pulsante diventa "Fatto"), poi tocca un giorno per ribaltarne lo stato: un giorno normalmente aperto diventa chiuso (ferie), una domenica o un lunedì normalmente chiusi diventano eccezionalmente aperti (utile nei periodi di lavoro intenso). Tocca di nuovo il giorno per tornare al comportamento di default. Tocca "Fatto" per uscire dalla modalità. Le chiusure/riaperture si sincronizzano come tutto il resto.
- **Il foglio Google resta comunque leggibile e modificabile normalmente** da PC, utile come backup o per dare un'occhiata veloce; le modifiche fatte lì vengono scaricate sul tablet alla sincronizzazione successiva.
- **Non cancellare o rinominare le colonne** create automaticamente nel foglio (id, aggiornatoIl, eliminato, ecc.): servono all'app per riconoscere i record. Puoi tranquillamente aggiungere fogli/colonne extra tue senza problemi, l'app usa solo quelle previste.
- La cancellazione di un cliente/prodotto/appuntamento dall'app non cancella subito la riga dal foglio: la marca come "eliminato" (colonna `eliminato` = TRUE), così anche i dispositivi offline sanno che va rimossa. È una scelta voluta per evitare perdite di dati.
- Se in futuro vuoi migliorare ulteriormente l'app (es. promemoria SMS ai clienti, statistiche vendite), possiamo aggiungerlo: la struttura è pensata per crescere.
