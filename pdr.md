# Product Design Record (PDR) - Notes App

## 1. Introduzione
Questo documento funge da linea guida per la progettazione e lo sviluppo dell'app **Notes**, un'applicazione web HTML per creare e organizzare note in una struttura gerarchica di cartelle. Questo file verrà aggiornato iterativamente ad ogni nuova richiesta per mantenere traccia delle funzionalità e delle specifiche dell'app.

L'app implementa la **persistenza automatica dello stato** tramite salvataggio offline locale (`localStorage`), che salva e ricarica le note e le cartelle in tempo reale ogni volta che chiudi e riapri l'applicazione.

## 2. Stile Visivo
- **Stile**: Minimal ed elegante, estetica pulita e raffinata.
- **Sfondo**: Nero puro (`#000000`) — ottimizzato per display AMOLED.
- **Bordi**: Bianchi/grigi chiari (`rgba(255,255,255,0.12)`) per i box e gli elementi interattivi.
- **Tipografia**: Font "Inter" da Google Fonts — pulito, moderno e leggibile.
- **Palette colori**: Monocromatica in bianco e nero con accenti minimali bianchi.
- **Icone**: SVG line-art con stroke bianco, stile minimal e coerente.
- **Animazioni**: Transizioni fluide e sottili per navigazione, apertura note e interazioni.

## 3. Struttura e Navigazione
L'app è basata su una **struttura gerarchica ad albero**:

1. **Homepage (Cartella Madre)**: La schermata principale funge da cartella radice. Mostra tutti gli elementi (cartelle e note) al primo livello.
2. **Cartelle**: Ogni cartella può contenere sottocartelle e/o note, senza limiti di profondità.
3. **Note**: Elementi di testo semplice, apribili in modalità di scrittura a schermo intero.
4. **Navigazione Breadcrumb**: In alto viene mostrato il percorso corrente (Home > Cartella > Sottocartella) per orientarsi nella gerarchia. Ogni segmento è cliccabile per tornare rapidamente a quel livello.

## 4. Creazione di Elementi
- **Pulsanti "+"**: In basso a destra sono presenti due pulsanti flottanti (FAB) impilati verticalmente:
  - **Cartella (sopra)**: Pulsante con l'icona della cartella e un piccolo "+" in basso a destra. Al click apre un popup minimale per inserire il nome della nuova cartella.
  - **Nota (sotto)**: Pulsante con l'icona del file e un piccolo "+" in basso a destra. Al click apre direttamente l'editor a schermo intero. L'editor presenta un campo per il titolo in alto e un'area per il testo sotto. Se si crea una nuova nota, il cursore viene posizionato subito sul titolo (aprendo la tastiera). Se si apre una nota esistente, l'editor si apre senza attivare automaticamente la tastiera.

## 5. Editor di Nota (Schermo Intero)
- **Stile Blocco Note**: L'editor occupa l'intero schermo del dispositivo. Ha un input dedicato per il titolo all'inizio e un'area di testo sotto. Nessun contorno o box visibile.
- **Area di Scrittura**: Un'area verticale con sfondo nero e testo bianco, font Inter.
- **Autofocus**: Nelle nuove note, il titolo prende il focus all'apertura. Per le vecchie note, la tastiera resta chiusa all'apertura finché l'utente non tocca uno dei campi.
- **Salvataggio Automatico**: Ogni modifica al testo o al titolo viene salvata in tempo reale.
- **Barra Superiore Minima**: Contiene il pulsante freccia indietro (←) per tornare alla cartella corrente, e sulla destra un pulsante toggle per la modalità lista.
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
- **Tap su Cartella**: Naviga dentro la cartella.
- **Tap su Nota**: Apre l'editor a schermo intero.
- **Swipe Laterale Orizzontale**: Scorrendo su un elemento (cartella o nota) a destra o sinistra vengono rivelate le icone minimali del cestino. Oltrepassata la soglia, l'elemento va nel cestino.
- **Trascinamento in Alto**: Cliccando e trascinando verso l'alto (pan-y) un elemento, scende una zona drop di colore bianco con un cestino in alto ("Rilascia per eliminare"). Rilasciando all'interno, va nel cestino.
- **Cestino e Impostazioni**: L'accesso al cestino avviene tramite l'icona ingranaggio (Impostazioni) in alto a destra. All'interno delle impostazioni è presente la sezione "Cestino" dove è possibile ripristinare o eliminare definitivamente gli elementi.
