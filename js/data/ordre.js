// Dans l'ordre ! : [événement, année] (année négative = avant J.-C.)
export default [
  ['Construction de la pyramide de Khéops', -2560], ['Fondation de Rome (selon la légende)', -753], ['Assassinat de Jules César', -44],
  ['Couronnement de Charlemagne', 800], ['Bataille d\'Hastings', 1066], ['Mort de Jeanne d\'Arc', 1431], ['Imprimerie de Gutenberg', 1450],
  ['Christophe Colomb arrive en Amérique', 1492], ['Fin du premier tour du monde (Magellan)', 1522], ['Mort de Louis XIV', 1715],
  ['Brevet de la machine à vapeur de James Watt', 1769], ['Indépendance des États-Unis', 1776], ['Premier vol en montgolfière', 1783],
  ['Prise de la Bastille', 1789], ['Premier vaccin (contre la variole)', 1796], ['Sacre de Napoléon', 1804], ['Bataille de Waterloo', 1815],
  ['Abolition de l\'esclavage en France', 1848], ['Création de la Croix-Rouge', 1863], ['Invention du téléphone', 1876], ['Ampoule électrique d\'Edison', 1879],
  ['Inauguration de la statue de la Liberté', 1886], ['Inauguration de la tour Eiffel', 1889], ['Première projection des frères Lumière', 1895],
  ['Premiers Jeux olympiques modernes', 1896], ['Premier vol des frères Wright', 1903], ['Premier Tour de France', 1903], ['Théorie de la relativité restreinte', 1905],
  ['Naufrage du Titanic', 1912], ['Début de la Première Guerre mondiale', 1914], ['Découverte de la pénicilline', 1928], ['Krach de Wall Street', 1929],
  ['Première Coupe du monde de football', 1930], ['Droit de vote des femmes en France', 1944], ['Fin de la Seconde Guerre mondiale', 1945],
  ['Découverte de la structure de l\'ADN', 1953], ['Gagarine, premier homme dans l\'espace', 1961], ['Premier album des Beatles', 1963], ['Mai 68', 1968],
  ['Premiers pas sur la Lune', 1969], ['Le Concorde entre en service', 1976], ['Sortie du premier Star Wars', 1977], ['Abolition de la peine de mort en France', 1981],
  ['Mise en service du TGV', 1981], ['Premier Macintosh', 1984], ['Catastrophe de Tchernobyl', 1986], ['Chute du mur de Berlin', 1989], ['Sortie de la Game Boy', 1989],
  ['Premier épisode des Simpson', 1989], ['Ouverture de Disneyland Paris', 1992], ['Traité de Maastricht', 1992], ['Inauguration du tunnel sous la Manche', 1994],
  ['Sortie du Roi Lion (dessin animé)', 1994], ['Nelson Mandela élu président', 1994], ['Sortie de la PlayStation', 1994], ['Sortie de Toy Story', 1995],
  ['Naissance de la brebis Dolly', 1996], ['Sortie des premiers jeux Pokémon', 1996], ['Sortie du film Titanic', 1997], ['La France championne du monde de football', 1998],
  ['Création de Google', 1998], ['Création de Wikipédia', 2001], ['Sortie de Shrek', 2001], ['Arrivée de l\'euro en pièces et billets', 2002],
  ['Lancement de Facebook', 2004], ['Création de YouTube', 2005], ['Sortie du premier iPhone', 2007], ['Élection de Barack Obama', 2008], ['Sortie du film Avatar', 2009],
  ['Lancement d\'Instagram', 2010], ['Sortie de Minecraft (version finale)', 2011], ['Mariage pour tous en France', 2013], ['Sortie de La Reine des neiges', 2013],
  ['Sortie de la Nintendo Switch', 2017], ['Sortie de Fortnite', 2017], ['Incendie de Notre-Dame de Paris', 2019], ['Premier confinement en France', 2020],
  ['Jeux olympiques de Paris', 2024],
];

export const fmtYear = (y) => (y < 0 ? `${-y} av. J.-C.` : String(y));
