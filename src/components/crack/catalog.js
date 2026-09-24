export const POSITIONS = { ARQ: { name: 'Arquero', plural: 'Arqueros', quota: 1 }, DEF: { name: 'Defensor', plural: 'Defensores', quota: 4 }, MED: { name: 'Mediocampista', plural: 'Mediocampistas', quota: 3 }, DEL: { name: 'Delantero', plural: 'Delanteros', quota: 3 } };

const groups = [
['ARQ', [['Gianluigi Buffon',95],['Iker Casillas',94],['Manuel Neuer',95],['Emiliano Martínez',88],['René Higuita',82],['Loris Karius',70],['Franco Armani',84],['Sergio Romero',83],['Agustín Rossi',82],['José Luis Chilavert',90],['San Alonso',100],['Dida',89],['Edwin van der Sar',92],['Oliver Kahn',93],['Roberto Abbondanzieri',86],['Ubaldo Fillol',93]]],
['DEF', [['Paolo Maldini',97],['Cafú',94],['Roberto Carlos',94],['Sergio Ramos',92],['Carles Puyol',91],['Alessandro Nesta',93],['Fabio Cannavaro',93],['Virgil van Dijk',91],['Marcelo',90],['Javier Zanetti',92],['Philipp Lahm',93],['Gerard Piqué',87],['Pepe',87],['Walter Samuel',87],['Nicolás Otamendi',84],['Cristian Romero',86],['Marcos Rojo',77],['Harry Maguire',78],['David Luiz',80],['Phil Jones',73],['Yerry Mina',76],['Gary Medel',79],['Frank Fabra',74],['Federico Fazio',76],['Gonzalo Montiel',82],['Milton Casco',80],['Nicolás Tagliafico',84],['Lisandro Martínez',86],['Luis Advíncula',80],['Carlos Izquierdoz',81],['Claudio “Chiqui” Tapia',43],['Rodolfo D’Onofrio',35],['Dani Alves',92],['Momo',52],['Gabriel Heinze',85],['Roberto Ayala',89],['Daniel Passarella',93],['Óscar Ruggeri',88],['Ashley Cole',90],['Juan Pablo Sorín',87],['Rafael Márquez',89],['Alejandro Domínguez',34],['Gabriel Mercado',81],['Ricardo Fort',36],['Diego Placente',82],['Fabricio Coloccini',84],['Lionel Scaloni',79],['Marcos Acuña',84],['Javier Milei',48]]],
['MED', [['Diego Maradona',99],['Zinedine Zidane',97],['Ronaldinho',96],['Andrés Iniesta',95],['Xavi Hernández',95],['Luka Modrić',95],['Andrea Pirlo',93],['Juan Román Riquelme',92],['Kaká',93],['Kevin De Bruyne',93],['Sergio Busquets',90],['N’Golo Kanté',90],['Ángel Di María',90],['Paul Pogba',85],['Arturo Vidal',86],['Marouane Fellaini',78],['Gennaro Gattuso',85],['Ricardo Caruso Lombardi',65],['Leonardo Ponzio',82],['Juan Sebastián Verón',91],['Pablo Aimar',89],['Ariel Ortega',89],['Andrés D’Alessandro',86],['Maxi Rodríguez',85],['Enzo Pérez',85],['Leandro Paredes',84],['Rodrigo De Paul',86],['Julio Grondona',32],['Carlos Valderrama',88],['Clarence Seedorf',91],['Ricardo Bochini',92],['Luquitas Rodríguez',42],['Esteban Cambiasso',88],['Fernando Redondo',92],['Michael Laudrup',93],['Carrera',40],['Jay-Jay Okocha',88],['Diego Simeone',87],['Éver Banega',85],['Guillermo Francella',41],['Sebastián Battaglia',85],['Bizarrap',44],['Chapu Martínez',40]]],
['DEL', [['Lionel Messi',99],['Cristiano Ronaldo',98],['Ronaldo Nazário',97],['Pelé',99],['Kylian Mbappé',94],['Erling Haaland',93],['Neymar',94],['Luis Suárez',93],['Robert Lewandowski',94],['Zlatan Ibrahimović',92],['Thierry Henry',95],['Sergio Agüero',91],['Carlos Tévez',89],['Martín Palermo',85],['Mario Balotelli',80],['Gonzalo Higuaín',87],['Darío Benedetto',77],['Miguel Merentiel',81],['Lautaro Martínez',90],['Julián Álvarez',89],['La cobra',40],['Gabriel Batistuta',94],['Ibai Llanos',25],['Davo',48],['Spreen',46],['Edinson Cavani',90],['David Trezeguet',90],['José Manuel Moreno',94],['Enzo Francescoli',92],['Markito Navaja',47],['Diego Forlán',91],['Samuel Eto’o',93],['Marcelo Tinelli',39],['René Houseman',90],['Claudio Caniggia',89],['Ezequiel Lavezzi',85],['Lucas Pratto',82],['Tung Tung Sahur',67],['Lucas Janson',75]]]
];

const phrases = ['El representante todavía no puede creer lo que pagaste.', 'Por esa plata, también tiene que cortar el pasto.', 'La camiseta ya está vendida. Ahora falta que juegue.', 'El scouting fue una corazonada. El presupuesto lo confirma.', 'Trae experiencia, talento y un bolso lleno de anécdotas.', 'En el asado del domingo, esta compra se discute.', 'La hinchada ya está buscando una canción que rime.', 'No vino por la plata. Vino porque apretaste el botón.', 'El contrato incluye fútbol. Los lujos se pagan aparte.', 'Si sale bien, sos un visionario. Si no, fue el representante.'];

// Se reserva el ID 124 para no cambiar los IDs de los jugadores posteriores
// en partidas ya guardadas de versiones anteriores.
const RETIRED_IDS = new Set([124]);
let nextId = 1;
export const CATALOG = groups
  .flatMap(([position, list]) => list.map(([name, rating, extra]) => ({ name, rating, position, ...extra })))
  .map((p, i) => {
    while (RETIRED_IDS.has(nextId)) nextId += 1;
    const player = { ...p, id: nextId, phrase: phrases[i % phrases.length] };
    nextId += 1;
    return player;
  });
const CATALOG_BY_ID = new Map(CATALOG.map(player => [player.id, player]));
export const byId = id => CATALOG_BY_ID.get(id);
