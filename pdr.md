# Product Design Record (PDR) - Notes App

## 1. Introduzione
Questo documento funge da linea guida per la progettazione e lo sviluppo dell'app **Notes**, un'applicazione web HTML per creare e organizzare note in una struttura gerarchica di cartelle. Questo file verrà aggiornato iterativamente ad ogni nuova richiesta per mantenere traccia delle funzionalità e delle specifiche dell'app.

L'app implementa la **persistenza automatica dello stato** tramite salvataggio offline locale (`localStorage`), che salva e ricarica le note e le cartelle in tempo reale ogni volta che chiudi e riapri l'applicazione.

## 2. Stile Visivo
- **Stile**: Minimal ed elegante, estetica pulita e raffinata.
- **Sfondo**: Nero puro (`#000000`) — ottimizzato per display AMOLED.
- **Bordi**: Bianchi/grigi chiari (`rgba(255,255,255,0.12)`) per i box e gli elementi interattivi.
- **Tipografia**: Font "Inter" da Google Fonts — pulito, moderno e leggibile (dimensione testo dell'editor impostata a `0.90rem` per massimizzare visibilità e minimalismo).
- **Palette colori**: Monocromatica in bianco e nero con accenti minimali (il colore di **ogni elemento originariamente bianco**, come icone, bottoni FAB, sfondi dei modali e titoli, viene modificato dinamicamente in base al tema scelto nelle impostazioni).
- **Icone**: SVG line-art che ereditano il colore dell'accento del tema, stile minimal e coerente.
- **Animazioni**: Transizioni fluide e sottili per navigazione, apertura note e interazioni.

## 3. Struttura e Navigazione
L'app è basata su una **struttura gerarchica ad albero**:

1. **Homepage (Cartella Madre)**: La schermata principale funge da cartella radice. Mostra tutti gli elementi (cartelle e note) al primo livello.
2. **Cartelle**: Ogni cartella può contenere sottocartelle e/o note, senza limiti di profondità.
3. **Note**: Elementi di testo semplice, apribili in modalità di scrittura a schermo intero.
4. **Navigazione Breadcrumb**: In alto viene mostrato il percorso corrente (Home > Cartella > Sottocartella) per orientarsi nella gerarchia. Ogni segmento è cliccabile per tornare rapidamente a quel livello.
5. **Navigazione ad Albero con History API**: Ogni azione di navigazione (apertura cartella, nota, impostazioni, ecc.) inserisce uno stato nella cronologia del browser (`history.pushState`). Il pulsante indietro (sia in-app che fisico Android) fa `history.back()`, che torna esattamente di un livello alla volta lungo il percorso esatto seguito dall'utente, fino alla homepage. Solo dalla homepage il tasto indietro chiude l'app. È importante notare che, per garantire un layout pulito, quando l'icona indietro scompare dalla homepage, il titolo principale "Notes" collassa a sinistra per allinearsi perfettamente con l'inizio della breadcrumb sottostante.

## 4. Creazione di Elementi
- **Pulsanti "+"**: In basso a destra sono presenti due pulsanti flottanti (FAB) impilati verticalmente:
  - **Cartella (sopra)**: Pulsante con l'icona della cartella e un piccolo "+" in basso a destra. Al click apre un popup minimale per inserire il nome della nuova cartella.
  - **Nota (sotto)**: Pulsante con l'icona del file e un piccolo "+" in basso a destra. Al click apre direttamente l'editor a schermo intero. L'editor presenta un campo per il titolo in alto e un'area per il testo sotto. Se si crea una nuova nota, il cursore viene posizionato subito sul titolo (aprendo la tastiera). Se si apre una nota esistente, l'editor si apre senza attivare automaticamente la tastiera.

## 5. Editor di Nota (Schermo Intero)
- **Stile Blocco Note**: L'editor occupa l'intero schermo del dispositivo. Ha un input dedicato per il titolo all'inizio e un'area di testo sotto. Nessun contorno o box visibile. All'apertura di una nota, l'editor viene sempre posizionato in cima (scroll to top).
- **Area di Scrittura**: Un'area verticale con sfondo nero e testo bianco, font Inter. L'area si auto-espande verticalmente all'inserimento del testo in modo da spingere gli eventuali allegati sotto tutto il contenuto testuale e consentire uno scroll naturale con la pagina madre.
- **Autofocus**: Nelle nuove note, il titolo prende il focus all'apertura. Per le vecchie note, la tastiera resta chiusa all'apertura finché l'utente non tocca uno dei campi.
- **Salvataggio Automatico**: Ogni modifica al testo o al titolo viene salvata in tempo reale.
- **Barra Superiore Minima**: Contiene il pulsante freccia indietro (←) per tornare alla cartella corrente, un pulsante toggle per la modalità lista, e un pulsante graffetta (📎) per allegare file.
- **Allegati File**:
  - Premendo l'icona graffetta in alto a destra si apre il file picker del dispositivo (supporto file multipli).
  - I file vengono salvati come base64 nell'array `note.attachments` in localStorage.
  - In fondo alla nota (scrollando dopo il testo), compare una sezione "File caricati" con bordo superiore separatore.
  - Le **immagini** vengono mostrate come anteprima visiva (max 300px di altezza, object-fit contain) con il nome del file sotto.
  - Gli **altri file** vengono mostrati come blocchetti con icona documento, nome del file e estensione/dimensione.
  - Ogni allegato ha un pulsante ✕ per eliminarlo singolarmente.
- **Conteggio Caratteri**: In basso a destra, un piccolissimo conteggio discreto dei caratteri totali.
- **Formattazione**: Testo puro (plain text), senza formattazione ricca, per mantenere la semplicità.
- **Modalità Lista/Checklist**:
  - Tramite l'icona "quadrato con spunta" in alto a destra, l'editor converte ogni riga di testo in un elemento di una lista interattiva.
  - L'icona in alto cambia in una "matitina", che se premuta riporta alla modalità di testo semplice (ripristina la nota unendo le righe).
  - Ogni riga della lista presenta: un quadratino spuntabile a sinistra, il testo editabile della riga, e l'icona del cestino a destra per cancellarla.
  - Spuntando un elemento, questo viene disattivato (testo sbarrato, minore opacità) e spostato in una sezione inferiore "Completato".
  - Tenendo premuta una riga (incluso il testo interno, ad eccezione dei pulsanti specifici come checkbox o cestino) è possibile trascinarla in su o giù per riordinarla rispetto alle altre righe attive.
  - È possibile aggiungere nuove righe rapidamente tramite il campo testuale dedicato posizionato dopo l'ultimo elemento attivo ma prima della sezione di quelli completati.

## 6. Visualizzazione Elementi nella Lista
- **Ordinamento Alfabetico**: Le cartelle vengono prima, seguite dalle note. All'interno di ciascun gruppo, gli elementi si organizzano automaticamente in ordine alfabetico (dalla A alla Z).
- **Cartelle**: Mostrate con un'icona cartella SVG minimal, nome a destra, e un'icona a forma di "matita" per rinominarle rapidamente tramite popup.
- **Note**: Mostrate con un'icona documento SVG minimal, titolo a destra, con un'anteprima del testo sotto in grigio e data dell'ultima modifica.

## 7. Azioni sugli Elementi e Meccaniche Cestino
- **Gestione Touch Intelligente**: Il sistema distingue in modo robusto tre gesti:
  - **Tap (tocco e breve rilascio)**: Apre l'elemento (cartella o nota). Per prevenire aperture accidentali durante lo scorrimento, il tap viene annullato in caso di spostamento del dito superiore a 15px o se interrotto da uno scroll nativo del browser (`pointercancel`).
  - **Movimento verticale (scroll)**: Scorre nativamente la lista delle note.
  - **Movimento orizzontale (swipe)**: Elimina l'elemento. La cattura del pointer ("pointer capture") avviene solo quando viene confermato un movimento laterale intenzionale, permettendo nel resto dei casi uno scorrimento fluido e naturale della lista.
  - **Pressione Prolungata (Long Press)**: Mantenendo la pressione (circa 500ms) su un elemento o una cartella senza spostamenti in pixel, si attiva il menu contestuale, segnalato da un breve feedback aptico. Il menu emerge in sovrimpressione permettendo azioni aggiuntive come "Rinomina" (solo cartelle), "Scarica" ed "Elimina".
    - L'azione **Scarica** esporta localmente i contenuti testuali. Le singole Note vengono salvate come `.txt` leggibili pur formattando idoneamente le checklist, se presenti. Se l'azione interviene su una cartella, tutti i suoi contenuti (ed eventuali sotto-cartelle annidate) vengono rielaborati in file `.txt` poi raggruppati internamente al browser e smistati localmente verso il dispositivo con un archivio `.zip`.
- **Tap su Cartella**: Naviga dentro la cartella.
- **Tap su Nota**: Apre l'editor a schermo intero.
- **Swipe Laterale Orizzontale**: Scorrendo su un elemento (cartella o nota) a destra o sinistra, la card si sposta rivelando lo sfondo scuro dell'app con l'icona del cestino nel colore del tema. Lo sfondo dello swipe è trasparente per permettere di vedere chiaramente la card che scorre. L'icona si ingrandisce fluidamente in base allo scorrimento (scaling progressivo da 0.8 a 1.3). Oltrepassata la soglia di 80px, l'elemento viene eliminato con un'animazione fluida di contrazione.
- **Cestino e Impostazioni**: L'accesso al cestino avviene tramite l'icona ingranaggio (Impostazioni) in alto a destra. All'interno delle impostazioni è presente la sezione "Cestino" dove è possibile ripristinare o eliminare definitivamente gli elementi.

## 8. Profilo Google & Sincronizzazione Drive
- **Sezione Profilo nelle Impostazioni**: Prima card nelle impostazioni, mostra "Profilo & Sync" con:
  - Stato disconnesso: pulsante "Connetti Account Google" con logo Google ufficiale a colori.
  - Stato connesso: avatar utente, nome, email, pulsante "Sincronizza ora", stato della sync, e pulsante "Disconnetti Account".
- **Autenticazione**: Utilizza Google Identity Services (GIS) con OAuth 2.0 Token Model. Scope richiesti: `drive.appdata`, `userinfo.profile`, `userinfo.email`.
- **Storage su Drive**: I dati vengono salvati come file JSON (`notes_app_data.json`) nella cartella `appDataFolder` di Google Drive (nascosta all'utente, riservata all'app).
- **Rilevamento Conflitti alla Connessione**: Quando l'utente collega l'account Google, l'app verifica subito la situazione:
  - **Locale vuoto + Cloud con dati** → scarica automaticamente i dati dal cloud.
  - **Locale con dati + Cloud vuoto** → carica automaticamente i dati locali sul cloud.
  - **Entrambi con dati** → mostra un dialogo di conflitto con il conteggio degli elementi su ciascun lato, chiedendo all'utente se vuole "Scarica dati dal cloud" (sovrascrive locale) o "Carica dati locali sul cloud" (sovrascrive Drive).
- **Strategia di Merge (sync successive)**: Per le sincronizzazioni automatiche successive alla prima, viene confrontato `updatedAt` per ogni elemento: vince il più recente tra locale e cloud.
- **Auto-sync Silenziosa**: La sincronizzazione parte in totale autonomia grazie al ripristino silenzioso del token all'avvio dell'applicazione. Nessun click manuale è più richiesto per agganciare l'account. Ogni modifica locale avvia un timer di 15 secondi al termine del quale parte la sync in modo completamente invisibile all'utente (nessun indicatore visivo). La sync interviene istantaneamente anche quando l'utente chiude l'app o passa a un'altra scheda/app (`visibilitychange` + `beforeunload`).
- **Sync Manuale**: Disponibile solo nelle impostazioni tramite il pulsante "Sincronizza ora", con feedback visivo sullo stato.
- **Configurazione**: Utilizza il `GOOGLE_CLIENT_ID` specifico del progetto su Google Cloud Console (configurato in `app.js`). L'app non verificata supporta fino a 100 utenti test configurati nella console.
