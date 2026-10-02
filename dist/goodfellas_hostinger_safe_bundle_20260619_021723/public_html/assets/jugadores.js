const goodfellasInitPlayers = () => {
  if (typeof window.goodfellasPlayersCleanup === 'function') {
    window.goodfellasPlayersCleanup();
  }
  (() => {
    const playerPageAbortController = new AbortController();
    window.goodfellasPlayersCleanup = () => playerPageAbortController.abort();
    document.addEventListener('goodfellas:before-partial-render', window.goodfellasPlayersCleanup, { once: true });
    const statNames = ['technique', 'rhythm', 'defense_physical', 'attack', 'teamwork', 'mentality', 'regularity'];
    const normalizeSixRating = (value, fallback = 1) => {
      const number = Number.parseFloat(String(value ?? ''));
      const base = Number.isFinite(number) ? number : fallback;
      return Math.max(1, Math.min(6, Math.round(base * 10) / 10));
    };
    const formatRating = (rating) => Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
    const cardOverallFromSix = (value) => {
      const clamped = Math.max(1, Math.min(6, Number(value) || 1));
      const anchors = [[1, 35], [2.5, 54], [3, 64], [3.2, 69], [3.5, 74], [3.8, 79], [4, 81], [4.4, 86], [4.5, 87], [5, 92], [5.2, 93], [5.3, 94], [6, 98]];
      for (let index = 0; index < anchors.length - 1; index += 1) {
        const [fromRating, fromOverall] = anchors[index];
        const [toRating, toOverall] = anchors[index + 1];
        if (clamped <= toRating) {
          const ratio = (clamped - fromRating) / (toRating - fromRating);
          return Math.round(fromOverall + ((toOverall - fromOverall) * ratio));
        }
      }
      return 98;
    };
    const statBarColor = (value) => {
      const rating = Number(value) || 1;
      if (rating >= 5.95) return '#16a34a';
      if (rating >= 4) return '#84cc16';
      if (rating >= 3) return '#f59e0b';
      return '#ef4444';
    };
    const radarLabels = {
      technique: 'Tecnica',
      rhythm: 'Ritmo',
      defense_physical: 'Solidez',
      attack: 'Ataque',
      teamwork: 'Juego en equipo',
      mentality: 'Mentalidad',
      regularity: 'Regularidad',
      goalkeeper_skill: 'Arquero',
    };
    const radarShortLabels = {
      technique: 'TEC',
      rhythm: 'RIT',
      defense_physical: 'SOL',
      attack: 'ATA',
      teamwork: 'EQU',
      mentality: 'MEN',
      regularity: 'REG',
      goalkeeper_skill: 'ARQ',
    };
    const roleDisplayLabels = {
      arquero: 'arquero',
      defensor: 'defensor',
      lateral: 'lateral',
      mediocampista: 'mediocampista',
      delantero: 'delantero',
      comodin: 'comodin',
    };
    const qualitativeRating = (value) => {
      const rating = numberOr(value, 3);
      if (rating >= 5.5) return 'excelente';
      if (rating >= 4) return 'bueno';
      if (rating >= 2.75) return 'medio';
      return 'bajo';
    };
    const qualitativeStatText = (stat) => {
      const quality = qualitativeRating(stat.value);
      const feminine = ['Tecnica', 'Solidez', 'Mentalidad', 'Regularidad'].includes(stat.label);
      const adjective = feminine
        ? ({ bueno: 'buena', medio: 'media', bajo: 'baja' }[quality] || quality)
        : quality;
      return `${stat.label} ${adjective}`;
    };
    const scoutStatRules = [
      {
        field: 'technique',
        label: 'Tecnica',
        strength: ['la pelota todavia le rebota como baldosa floja', 'tiene lo basico: no tira lujos, pero tampoco se prende fuego solo', 'controla, descarga y no se mete en cuentos raros', 'ya se anima a pisarla y levantar la cabeza', 'tiene pie fino: donde otros revientan, el tipo intenta jugar', 'trae joystick incorporado: la pelota le hace caso'],
        weakness: ['si le tiran un melon, capaz lo devuelve en sandia', 'cuando lo apuran, el primer control puede pedir auxilio', 'no es negado, pero tampoco le pidas una rabona en el area', 'a veces le falta un toque mas limpio para quedar bien perfilado', 'con la pelota casi siempre sale bien parado', 'hasta cuando se equivoca parece que quiso hacer algo distinto'],
      },
      {
        field: 'rhythm',
        label: 'Ritmo',
        strength: ['va en tercera aunque el partido pida autopista', 'no es una moto, pero llega si no lo hacen cruzar todo el conurbano', 'cumple el recorrido sin hacer ruido', 'tiene nafta para ir y volver sin pedir cambio', 'mete quinta y aparece donde la jugada ya parecia perdida', 'te corre todo el partido sin descanso'],
        weakness: ['si el partido se hace largo, empieza a mirar el banco con carino', 'si lo hacen correr de lado a lado, se le prende la reserva', 'en un partido de ida y vuelta, no mantiene el ritmo de subir y bajar', 'no se cae fisicamente, pero tampoco te gana una carrera al bondi', 'por piernas casi nunca queda pagando', 'en ritmo va sobrado: al rival le conviene buscar otro camino'],
      },
      {
        field: 'defense_physical',
        label: 'Solidez',
        strength: ['en el choque todavia entra pidiendo permiso', 'si viene uno pesado, lo puede hacer retroceder un par de casilleros', 'aguanta la parada, sin ponerse el traje de sheriff', 'mete cuerpo y ya no regala la zona', 'va al roce como quien va al almacen: sin drama y con decision', 'es pared medianera: choca, rebota y te cobra alquiler'],
        weakness: ['en el mano a mano fuerte lo pueden mandar a comprar facturas', 'si el rival lo obliga al roce, puede pasarla incomodo', 'cuando se arma el bardo, le cuesta sacar pecho', 'no es drama, pero si lo cargan mucho puede perder alguna dividida', 'para moverlo hay que traer orden judicial', 'fisicamente responde como patron de estancia'],
      },
      {
        field: 'attack',
        label: 'Ataque',
        strength: ['arriba todavia entra con timbre, no con llave', 'llega a zona caliente, pero a veces se le nubla el GPS', 'participa y molesta, aunque no siempre huele sangre', 'ya pisa el area y obliga a que alguno lo siga', 'tiene olfato: le das media baldosa y te arma un lio', 'en el area es inspector de billeteras: si te descuidas, te cobra'],
        weakness: ['en los ultimos metros se le puede apagar la tele', 'puede fabricar la jugada y terminar eligiendo el boton equivocado', 'con el arco enfrente a veces se apura como si cerrara el chino', 'no siempre liquida, pero ya obliga a respetarlo', 'arriba cuesta dejarlo mudo', 'cerca del arco no perdona ni una deuda chica'],
      },
      {
        field: 'teamwork',
        label: 'Juego en equipo',
        strength: ['le cuesta entrar en el circuito colectivo', 'por momentos juega su partido aparte', 'acompaña, aunque todavia puede ofrecerse mas', 'se conecta bien y entiende cuando soltarla', 'juega para el equipo, levanta la cabeza y ordena a los de al lado', 'es el pegamento del equipo: habla, ayuda y mejora a todos'],
        weakness: ['si se corta solo, el equipo lo siente enseguida', 'puede quedar lejos de la jugada cuando toca ayudar', 'a veces acompana mas de lo que conduce', 'no preocupa, aunque puede participar mas en la sociedad', 'su juego colectivo rara vez deja dudas', 'hasta sin pelota juega para que el equipo respire'],
        strength: ['todavia juega medio en modo solista de karaoke', 'a veces acompana, a veces mira la obra desde la vereda', 'se suma al circuito, aunque puede pedirla un poquito mas', 'entiende la pared, la descarga y el favor al companero', 'juega con documento: ayuda, habla y no se borra', 'es delegado del equipo: ordena, cubre y encima te ceba el mate'],
        weakness: ['si se corta solo, el equipo queda pagando el peaje', 'cuando toca dar una mano, a veces llega tarde a la reunion', 'acompanar acompana, pero le falta mandar un poco mas', 'no desentona, pero puede asociarse un poco mas', 'en juego de equipo rara vez deja una silla vacia', 'hasta sin tocarla acomoda el quilombo'],
      },
      {
        field: 'mentality',
        label: 'Mentalidad',
        strength: ['se va del partido cuando el ruido sube', 'todavia necesita ordenar la cabeza cuando algo sale mal', 'sostiene el foco aceptablemente, aunque puede tener baches', 'compite con buena cabeza y no se cae facil', 'tiene caracter para bancar partidos trabados', 'mentalmente es de los que ordenan al equipo cuando quema'],
        weakness: ['si lo sacan del eje, tarda en volver', 'puede hablar de mas y perder el foco de la jugada', 'cuando el partido se ensucia, necesita mas temple', 'no preocupa, pero puede sostener mejor la concentracion', 'casi siempre mantiene la cabeza en partido', 'en mentalidad es muy confiable incluso cuando viene torcida'],
      },
      {
        field: 'regularity',
        label: 'Regularidad',
        strength: ['todavia es una moneda al aire: puede venir iluminado o venir con la luz cortada', 'tiene ratos buenos, aunque todavia mezcla una bien con una que hace mirar al cielo', 'suele sostener un nivel aceptable sin regalar demasiados pozos', 'mantiene una linea bastante confiable y no se cae por cualquier golpe del partido', 'rinde casi siempre cerca de su mejor version: no vende humo de un solo domingo', 'es relojito: lo pones y sabes que no te va a dejar tirado cuando el partido aprieta'],
        weakness: ['si arranca torcido, puede pasar medio partido intentando encontrarse', 'todavia tiene bajones que cambian la lectura de todo lo bueno que hizo', 'su piso no siempre acompana a su techo: por momentos parece otro jugador', 'no se cae seguido, pero cuando baja un cambio el equipo lo nota', 'rara vez baja de su nivel habitual, y eso lo vuelve muy confiable', 'su peor partido igual suele ser competitivo: no se borra ni en dia torcido'],
      },
      {
        field: 'goalkeeper_skill',
        label: 'Arquero',
        strength: ['en el arco necesita que la defensa no lo abandone como bondi de noche', 'saca alguna importante, pero todavia no da para estatua', 'cumple bajo los tres palos y evita papelones', 'achica bien y ya empieza a hacerse respetar', 'se agranda en el arco: tapa, grita y acomoda el boliche', 'es persiana metalica: baja y no entra nadie'],
        weakness: ['cada centro puede venir con musica de suspenso', 'si lo bombardean, puede empezar a mirar de reojo', 'necesita que la defensa no le tire la mochila entera', 'no es flojo, pero podria mandar mas en el area', 'bajo presion responde con cara de pocos amigos', 'en el arco casi no deja ni la propina'],
      },
    ];

    const datasetStatName = (field) => `playerScout${field.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')}`;
    const numberOr = (value, fallback = 3) => {
      const number = Number.parseFloat(String(value ?? ''));
      return Number.isFinite(number) ? number : fallback;
    };
    const starTier = (value) => Math.max(1, Math.min(6, Math.round(numberOr(value, 3))));
    const stableIndex = (seed, length) => {
      if (length <= 1) return 0;
      let hash = 0;
      String(seed).split('').forEach((char) => {
        hash = ((hash << 5) - hash) + char.charCodeAt(0);
        hash |= 0;
      });
      return Math.abs(hash) % length;
    };
    const statAliases = {
      technique: ['tecnica', 'el pie', 'la pelota en los pies', 'el trato con la redonda'],
      rhythm: ['ritmo', 'las piernas', 'la intensidad', 'el ida y vuelta'],
      defense_physical: ['solidez', 'el roce', 'la marca', 'la batalla fisica'],
      attack: ['ataque', 'el ultimo tramo', 'la zona caliente', 'el olor a gol'],
      teamwork: ['juego en equipo', 'el juego colectivo', 'la solidaridad', 'la sociedad'],
      mentality: ['mentalidad', 'la cabeza', 'el caracter', 'el foco'],
      regularity: ['regularidad', 'la constancia', 'el piso de rendimiento', 'la estabilidad'],
      goalkeeper_skill: ['el arco', 'los tres palos', 'la seguridad bajo palos', 'el buzo imaginario'],
    };
    const strengthTemplates = [
      (alias, phrase) => `Por el lado de ${alias}, ${phrase}.`,
      (alias, phrase) => `Si la charla va por ${alias}, ${phrase}.`,
      (alias, phrase) => `En el rubro ${alias}, ${phrase}.`,
      (alias, phrase, label) => label === 'Ataque'
        ? `Se destaca atacando: ${phrase}.`
        : (label === 'Tecnica' ? `Es peligroso cuando ataca: ${phrase}.` : `${label} le pone el cartel luminoso: ${phrase}.`),
      (alias, phrase) => `Cuando aparece ${alias}, ${phrase}.`,
    ];
    const weaknessTemplates = [
      (alias, phrase) => `Cuando toca mirar ${alias}, ${phrase}.`,
      (alias, phrase) => `La lupa, mala pero necesaria, cae en ${alias}: ${phrase}.`,
      (alias, phrase) => `Si el rival es vivo, lo va a medir en ${alias}: ${phrase}.`,
      (alias, phrase) => `El semaforo amarillo aparece en ${alias}: ${phrase}.`,
      (alias, phrase) => `El costado para apretarlo viene por ${alias}: ${phrase}.`,
    ];
    const regularClosingLines = [
      'Le pone toda la onda para jugar; si lo presionan muy fuerte, puede empezar a mandarse cagadas o a cobrar boludeces.',
      'Cuando juega comodo suma un monton; cuando lo aprietan donde menos quiere, necesita resolver simple.',
      'Si el partido lo lleva a su baldosa, crece; si lo empujan a decidir rapido, puede mostrar la costura.',
      'En su mejor version te acomoda la tarde; en su peor rato, el rival tiene que insistir justo donde mas le pica.',
    ];
    const eliteClosingLines = [
      'Si tiene ganas te puede ganar solo el partido; si lo pones nervioso, capaz lo podes sacar del partido.',
    ];
    const statPhrase = (stat, type, playerName) => {
      const tier = starTier(stat.value);
      const phrase = stat[type][tier - 1];
      if (type === 'weakness' && stat.field === 'teamwork' && tier === 1) {
        return 'Cuando se toca hablar de companerismo, a veces prefiere un lujo que jugar rapido.';
      }
      if (type === 'weakness' && stat.field === 'teamwork' && tier === 2) {
        return 'Si hay algo negativo por decir es el trabajo en equipo: si tiene que tocar rapido, o bancarse el ida y vuelta, se cansa rapido.';
      }
      const aliasPool = statAliases[stat.field] || [stat.label.toLowerCase()];
      const templates = type === 'strength' ? strengthTemplates : weaknessTemplates;
      const seed = `${playerName}|${stat.field}|${type}|${tier}`;
      const alias = aliasPool[stableIndex(`${seed}|alias`, aliasPool.length)];
      const template = templates[stableIndex(`${seed}|template`, templates.length)];
      return template(alias, phrase, stat.label);
    };
    const regularityInsightLine = (player) => {
      const regularity = numberOr(player.regularity, 3.5);
      const overall = numberOr(player.skill, 3);
      const tier = starTier(regularity);
      const pools = {
        1: [
          'Regularidad es su alarma roja: puede tener un partido buenisimo y al siguiente jugar como si hubiera llegado tarde a su propio cuerpo.',
          'El problema no es solo cuanto sabe jugar, sino que no siempre aparece la misma version; cuando se cae, se nota demasiado.',
          'Su rendimiento viene con ruleta incluida: si engancha una mala tarde, el equipo tiene que empezar a cubrirle los baches.',
        ],
        2: [
          'Tiene momentos donde suma, pero todavia alterna bastante: si entra mal al partido, le cuesta acomodarse.',
          'Su regularidad todavia pide paciencia; puede regalar un rato bueno y despues desaparecer justo cuando el equipo lo necesita.',
          'Tiene buenos pasajes, pero todavia no garantiza continuidad: puede arrancar fuerte y terminar jugando a media luz.',
        ],
        3: [
          'En regularidad esta en zona media: normalmente cumple, aunque todavia puede tener algun pozo que le baja la nota.',
          'No es una loteria total, pero tampoco un cheque certificado; suele rendir, con algun altibajo dando vueltas.',
          'Su constancia es aceptable: no te desarma el equipo, pero todavia puede tener ratos donde baja un cambio de mas.',
        ],
        4: [
          'Tiene buen piso de rendimiento: capaz no siempre rompe el partido, pero casi nunca te lo tira por la ventana.',
          'Regularidad le suma bastante: suele estar cerca de lo que promete la planilla y eso ordena al equipo.',
          'Su version habitual es bastante estable: no necesita estar iluminado para seguir siendo util.',
        ],
        5: [
          'Es confiable: no depende tanto de estar inspirado, casi siempre entrega una version fuerte y parecida.',
          'Su constancia pesa: puede no ser el mas vistoso cada fecha, pero rara vez baja de competitivo.',
          'Tiene rendimiento de confianza: cuando el partido se pone raro, normalmente sigue dentro de su libreto.',
        ],
        6: [
          'Es una garantia de rendimiento: incluso en dia flojo sostiene el piso y no obliga al equipo a taparle agujeros.',
          'Regularidad altisima: no vive de chispazos, vive de repetir buenas decisiones hasta que el rival se cansa.',
          'Tiene regularidad premium: puede variar el rival, la cancha o el clima, pero su aporte casi siempre aparece.',
        ],
      };
      const pool = pools[tier] || pools[3];
      const base = pool[stableIndex(`${player.name}|regularity-line|${tier}|${starTier(overall)}`, pool.length)];
      if (overall >= 4.5 && regularity <= 2.5) {
        return `${base} Tiene techo alto, pero esa irregularidad lo vuelve dificil de medir.`;
      }
      if (overall >= 4.5 && regularity >= 4.5) {
        return `${base} Cuando talento y constancia se juntan, ahi aparece el jugador que te cambia el sorteo.`;
      }
      return base;
    };
    const regularityContextLine = (player, best, weakest) => {
      const regularity = numberOr(player.regularity, 3.5);
      const overall = numberOr(player.skill, 3);
      const bestLabel = (best?.label || 'su fuerte').toLowerCase();
      const weakestLabel = (weakest?.label || 'su punto flojo').toLowerCase();
      const tier = starTier(regularity);
      const pools = [];

      if (regularity >= 4.5) {
        pools.push(`La regularidad hace que ${bestLabel} no sea solo un chispazo: suele aparecer varias veces en el mismo partido.`);
        pools.push(`Lo interesante es el piso: aun cuando ${weakestLabel} aparece como deuda, no suele arrastrarlo todo el partido.`);
        if (overall >= 4) {
          pools.push(`Como tiene buen nivel y encima constancia, no depende tanto de una jugada aislada para justificar el puntaje.`);
        }
      } else if (regularity <= 2.5) {
        pools.push(`La irregularidad le cambia la foto: ${bestLabel} puede brillar un rato, pero no siempre lo sostiene hasta el final.`);
        pools.push(`Cuando baja la persiana, ${weakestLabel} se nota mas de la cuenta y el equipo tiene que compensarlo.`);
        if (overall >= 4) {
          pools.push(`Tiene puntaje para ser importante, pero la regularidad baja hace que su promedio mienta un poco: no todos los dias entrega ese jugador.`);
        }
      } else {
        pools.push(`Con regularidad media, su relato hay que leerlo con matiz: ${bestLabel} aparece, pero todavia puede tener tramos apagados.`);
        pools.push(`No es inestable al punto de preocupar siempre, aunque ${weakestLabel} puede crecer si el partido lo agarra mal parado.`);
      }

      return pools[stableIndex(`${player.name}|regularity-context|${tier}|${best?.field || ''}|${weakest?.field || ''}|${starTier(overall)}`, pools.length)];
    };
    const comboInsightLine = (player) => {
      const technique = numberOr(player.technique, 3);
      const rhythm = numberOr(player.rhythm, 3);
      const defense = numberOr(player.defense_physical, 3);
      const attack = numberOr(player.attack, 3);
      const teamwork = numberOr(player.teamwork, 3);
      const regularity = numberOr(player.regularity, 3.5);
      const goalkeeper = numberOr(player.goalkeeper_skill, 3);
      const isGoalkeeper = player.positions[0] === 'ARQ';
      const high = (value) => value >= 4.5;
      const low = (value) => value <= 2.5;
      const matches = [];

      if (numberOr(player.skill, 3) < 3) {
        matches.push('Es buen tipo y ayuda a completar la cancha; futbolisticamente viene con casco y chaleco, pero viene.');
        matches.push('Hace lo que puede: a veces suma por presencia, a veces por fe, pero no se esconde.');
        matches.push('Viene a jugar igual, sabiendo que a veces es mas lo que estorba en la cancha que lo que ordena.');
        matches.push('No sera el distinto, pero es de esos que aparecen cuando falta uno y eso tambien vale en el fulbito.');
        matches.push('Tiene mas voluntad que recursos, pero al menos no deja al grupo clavado buscando reemplazo.');
      }
      if (numberOr(player.skill, 3) > 5) {
        matches.push('Destaca al lado de todos los demas muertos: juega a otra velocidad mental y encima se nota.');
        matches.push('En este grupo hace una de las mayores diferencias: cuando aparece, el partido se inclina solo.');
        matches.push('Hay que agradecerle que quiera jugar con tanto desorden alrededor: baja al barro y aun asi deja calidad.');
        matches.push('Esta un escalon arriba del promedio del potrero: si se enchufa, hay que repartirlo entre dos marcas.');
        matches.push('Cuando toca la pelota se nota que no vino a pasear: el resto mira y trata de no molestar.');
      }

      if (attack >= 4.5 && defense <= 2.5) {
        matches.push('No te marca a nadie, pero hace goles: es de esos que atras te hacen renegar y arriba te pagan la cuota.');
      }
      if (technique >= 4.5 && teamwork <= 2.5) {
        matches.push('Tiene magia en los pies, pero a veces es muy morfon: ve el pase y aun asi prueba el firulete.');
      }
      if (technique >= 4.5 && defense <= 2.5) {
        matches.push(defense <= 2
          ? 'No le gusta que lo marquen al hombre: si le respiran en la nuca, empieza la novela.'
          : 'Si lo marcas fuerte se le congela el pecho: con espacio juega lindo, con roce ya no canta tan afinado.');
      }
      if (high(attack) && high(technique) && low(defense)) {
        matches.push('No te pone la pierna fuerte ni aunque le pagues: arriba juega lindo, pero en el roce se hace el distraido.');
      }
      if (defense >= 4.5 && technique <= 2.5) {
        matches.push('No le pidas que te tire un caño ni que salga jugando: lo suyo es morder, trabar y devolver la pelota sin perfume.');
      }

      if (high(technique) && low(rhythm)) {
        matches.push('Tiene pie de salon, pero motor de domingo despues del asado: si le das tiempo te pinta la cara, si lo haces correr se complica.');
      }
      if (high(rhythm) && low(technique)) {
        matches.push('Corre como si llegara tarde al laburo, pero con la pelota a veces parece que la persigue mas de lo que la maneja.');
      }
      if (high(technique) && low(attack)) {
        matches.push('Juega lindo hasta la puerta del area; despues le falta tocar el timbre y entrar a cobrar.');
      }
      if (high(attack) && low(technique)) {
        matches.push('No le pidas poesia, pedile que empuje la pelota: capaz no acaricia la redonda, pero cerca del arco molesta siempre.');
      }
      if (high(rhythm) && low(defense)) {
        matches.push('Tiene piernas para perseguir hasta el bondi, pero en la marca a veces corre mucho y muerde poco.');
      }
      if (high(defense) && low(rhythm)) {
        matches.push('Cuando lo agarran parado es una pared, pero si lo sacan a pasear por la banda puede pedir remiseria.');
      }
      if (high(rhythm) && low(attack)) {
        matches.push('Va y viene como ascensor de hospital, aunque arriba muchas veces llega con las ideas en otra cancha.');
      }
      if (high(attack) && low(rhythm)) {
        matches.push('En el area tiene veneno, pero no le pidas que presione hasta la esquina porque se queda sin monedas.');
      }
      if (high(rhythm) && low(teamwork)) {
        matches.push('Corre por todos lados, pero a veces parece que juega con Waze propio y se olvida de los companeros.');
      }
      if (high(teamwork) && low(rhythm)) {
        matches.push('Tiene alma de equipo, habla y ordena, pero las piernas no siempre firman el contrato.');
      }
      if (high(defense) && low(attack)) {
        matches.push('Te apaga incendios atras, pero no le hace un gol ni al arcoiris.');
      }
      if (high(attack) && low(teamwork)) {
        matches.push('Arriba te mete goles, pero es medio morfon: si levanta la cabeza, el equipo le va a agradecer.');
      }
      if (high(teamwork) && low(attack)) {
        matches.push('Hace jugar a todos, pero cuando queda para definir parece que le pasa la pelota caliente al de al lado.');
      }
      if (high(defense) && low(teamwork)) {
        matches.push('Va fuerte y gana duelos, pero cuidado: puede defender su quintita y olvidarse de cerrar con el resto.');
      }
      if (high(teamwork) && low(defense)) {
        matches.push('Tiene voluntad de sobra, pero en el roce a veces le falta maldad de potrero.');
      }
      if (defense < 3 && teamwork < 3) {
        matches.push('Cuando lo aprietan en su zona floja, puede tirar un pelotazo a cualquier lado.');
      }
      if (high(regularity) && numberOr(player.skill, 3) >= 4) {
        matches.push('Lo bueno no es solo el techo: suele repetirlo, y eso en equipos parejos vale doble.');
      }
      if (low(regularity) && numberOr(player.skill, 3) >= 4) {
        matches.push('Tiene nivel para romperla, pero no siempre aparece la misma version: te puede ganar el partido o dejarte esperando.');
      }
      if (isGoalkeeper && high(goalkeeper) && low(defense)) {
        matches.push('Como arquero te salva las papas, pero si sale del arco a chocar queda mas expuesto que persiana rota.');
      }
      if (isGoalkeeper && high(goalkeeper) && low(teamwork)) {
        matches.push('Bajo los tres palos responde, pero si no habla con la defensa el area se le vuelve una feria.');
      }
      if (isGoalkeeper && high(defense) && low(goalkeeper)) {
        matches.push('Tiene presencia y cuerpo, pero bajo los tres palos todavia no te vende seguro contra todo riesgo.');
      }
      if (isGoalkeeper && high(teamwork) && low(goalkeeper)) {
        matches.push('Ordena y acompana, pero cuando le patean al arco necesita que la tribuna rece bajito.');
      }

      if (!matches.length) return '';
      return matches[stableIndex(`${player.name}|combo|${starTier(technique)}|${starTier(rhythm)}|${starTier(defense)}|${starTier(attack)}|${starTier(teamwork)}|${starTier(regularity)}|${starTier(goalkeeper)}`, matches.length)];
    };
    const radarShapeLine = (stats, playerName, isGoalkeeper) => {
      const values = stats.map((stat) => stat.value);
      const average = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
      const max = Math.max(...values);
      const min = Math.min(...values);
      const spread = max - min;
      const top = stats.slice().sort((a, b) => b.value - a.value).slice(0, 2).map((stat) => stat.field);
      const bottom = stats.slice().sort((a, b) => a.value - b.value).slice(0, 2).map((stat) => stat.field);
      const statValue = (field) => stats.find((stat) => stat.field === field)?.value || 0;
      const hasTop = (...fields) => fields.some((field) => top.includes(field) && statValue(field) >= 4);
      const hasBottom = (...fields) => fields.some((field) => bottom.includes(field) && statValue(field) <= 2.5);
      let pool;

      if (spread <= 0.75 && average >= 4.2) {
        pool = [
          'El radar sale redondito y alto: no tiene una esquina para esconderse, de esos que caen a la cancha y te acomodan el equipo.',
          'La figura parece dibujada con compas: parejo, confiable y sin un costado regalado para que el rival haga negocio.',
        ];
      } else if (spread <= 0.75) {
        pool = [
          'El radar es parejo: no te vende humo con una punta gigante, pero tampoco deja un pozo para caer de cabeza.',
          'La silueta sale de jugador cumplidor: no te prende fuego la planilla, pero tampoco te rompe el asado.',
        ];
      } else if (
        (statValue('attack') >= 4 && statValue('defense_physical') <= 2)
        || (statValue('defense_physical') >= 4 && statValue('attack') <= 2)
      ) {
        pool = [
          'Es de esos jugadores bien de puesto: si lo usas donde va, suma; fuera de su posicion sufre bastante.',
          'El radar lo marca clarito: en una punta ayuda mucho, pero si lo corres al otro trabajo se le complica.',
        ];
      } else if (spread >= 2.5) {
        pool = [
          'Hace bien su trabajo, pero a veces se manda alguna cagada.',
          'Tiene perfil de especialista: si lo llevas a su fuerte, suma; si lo sacas de ahi, baja bastante.',
        ];
      } else if (hasTop('attack', 'technique') && hasBottom('defense_physical', 'teamwork')) {
        pool = [
          'El dibujo se le va para adelante: pide pelota y arco, pero atras conviene ponerle un primo que lo cubra.',
          'La forma del radar grita jugador ofensivo: arriba puede salir en la foto, en la vuelta hay que prenderle el GPS.',
        ];
      } else if (statValue('defense_physical') >= 4 && statValue('teamwork') >= 4) {
        pool = [
          'Es un todoterreno, corre, mete, marca, ayuda, ataca, no le interesa jugar lindo, quiere ganar.',
          'La figura tira para el sacrificio: de esos que hacen el laburo sucio para que otro salga en la foto.',
        ];
      } else if (false && hasTop('defense_physical', 'teamwork') && hasBottom('attack', 'technique')) {
        pool = [
          'El radar se planta mas con casco que con moño: sostiene, ayuda y compite, aunque no siempre firma la jugada linda.',
          'La figura tira para el sacrificio: de esos que hacen el laburo sucio para que otro salga en la foto.',
        ];
      } else if (hasTop('rhythm') && hasBottom('technique', 'attack')) {
        pool = [
          'El radar muestra motor antes que seda: corre, llega y molesta, pero a veces la jugada le pide bajar un cambio.',
          'La silueta tiene piernas largas y pie de barrio: puede acelerar el partido, no siempre elegir el mejor final.',
        ];
      } else if (hasTop('teamwork') && spread <= 1.75) {
        pool = [
          'El radar tiene forma de jugador de equipo: no vive para la tapa, vive para que la rueda gire.',
          'La lectura global dice companero util: aparece donde falta una mano y no te desordena el tablero.',
        ];
      } else if (hasTop('teamwork') && spread <= 1.75) {
        pool = [
          'El radar tiene forma de jugador de equipo: no vive para la tapa, vive para que la rueda gire.',
          'La lectura global dice compañero util: aparece donde falta una mano y no desacomoda el tablero.',
        ];
      } else if (isGoalkeeper && hasTop('goalkeeper_skill')) {
        pool = [
          'El radar se agranda bajo los tres palos: si el partido pide arquero, ahi tiene con que ponerse la capa.',
          'La forma lo cuenta sola: su kiosco esta en el arco, donde puede transformar peligro en alivio.',
        ];
      } else {
        pool = [
          'La forma del radar deja un perfil mixto: tiene por donde sumar y tambien una arista para ajustar antes de que lo madruguen.',
          'Mirado de lejos, el radar no miente: hay una virtud clara en su juego, pero comete algunas fallas que el rival puede aprovechar.',
        ];
      }

      return pool[stableIndex(`${playerName}|shape|${top.join('-')}|${bottom.join('-')}|${Math.round(spread * 10)}`, pool.length)];
    };
    const colorCommentLine = (player, role) => {
      const technique = numberOr(player.technique, 3);
      const rhythm = numberOr(player.rhythm, 3);
      const defense = numberOr(player.defense_physical, 3);
      const attack = numberOr(player.attack, 3);
      const teamwork = numberOr(player.teamwork, 3);
      const regularity = numberOr(player.regularity, 3.5);
      const goalkeeper = numberOr(player.goalkeeper_skill, 3);
      const overall = numberOr(player.skill, 3);
      const pool = [];

      if (overall >= 4.5) {
        pool.push('Tiene chapa de titular en cualquier picado serio: no necesita vender humo, agarra la pelota y ya te das cuenta la clase de jugador que es.');
        pool.push('Cuando se enchufa, los demas parecen extras de la pelicula.');
      }
      if (overall <= 3) {
        pool.push('Es de esos que capaz no te gana el partido, pero te salva la convocatoria del grupo.');
        pool.push('No viene con botines magicos, viene con ganas; a veces en este futbol eso ya es medio contrato.');
      }
      if (technique >= 4 && attack >= 4) {
        pool.push('Tiene cositas de lirico de potrero: pisa, mira y si le dan un metro empieza el show.');
        pool.push('No te perdona una, y a veces te tira alguna magia de esas que te inventan un problema de la nada.');
      }
      if (defense >= 4 && rhythm >= 4) {
        pool.push('Perfil tractor: mete, corre y te sigue hasta la parada del colectivo.');
        pool.push('No negocia una dividida y encima tiene piernas para repetir; molesto como tos en reunion.');
      }
      if (teamwork >= 4.5) {
        pool.push('Tiene alma de capitan sin cinta: acomoda, habla y juega para que el equipo no sea una murga.');
        pool.push('No se casa con la pelota: si hay que tocar y moverse, toca y se mueve.');
      }
      if (regularity >= 4.5) {
        pool.push('No vive de flashes: lo normal es que juegue cerca de su mejor version.');
      }
      if (regularity <= 2.5 && overall >= 4) {
        pool.push('Tiene dias de figura y dias para esconder la planilla: conviene mirarlo de cerca cuando arranca irregular.');
      }
      if (attack >= 4.5) {
        pool.push('Tiene sangre de nueve vivo: capaz toca dos pelotas y una termina con todos sacando del medio.');
        pool.push('En la zona caliente no va de visita, va a cobrar alquiler.');
      }
      if (defense >= 4.5) {
        pool.push('Tiene oficio de marcador viejo: no siempre sale lindo, pero el rival termina mirando para otro lado.');
        pool.push('Es de los que te dejan un recuerdito en la primera dividida para avisar que estan presentes.');
      }
      if (rhythm >= 4.5) {
        pool.push('Tiene motor de remisero en fin de mes: no para nunca y llega a todos lados.');
        pool.push('Le sobra recorrido; si el partido pide piernas, levanta la mano primero.');
      }
      if (technique <= 2.5 && defense <= 2.5) {
        pool.push('Si la pelota viene dificil y encima hay roce, conviene prender una vela.');
      }
      if (attack <= 2.5 && technique <= 2.5) {
        pool.push('En ataque no asusta ni al arquero distraido, pero por lo menos ocupa un defensor.');
      }
      if (role === 'defensor' && technique >= 4) {
        pool.push('Defensor con salida limpia: raro en el barrio, casi articulo importado.');
      }
      if (role === 'delantero' && teamwork >= 4) {
        pool.push('Delantero que devuelve paredes: especie protegida, hay que cuidarlo.');
      }
      if (role === 'mediocampista' && defense >= 4 && teamwork >= 4) {
        pool.push('Cinco de overol: barre, ordena y no pide aplausos.');
      }
      if (role === 'arquero' && goalkeeper >= 4.5) {
        pool.push('Cuando se pone los guantes imaginarios, el arco parece achicarse para todos menos para el.');
      }

      if (!pool.length) {
        pool.push('Tiene perfil de fulbito puro: algo para aplaudir, algo para putear y bastante para comentar despues.');
        pool.push('No pasa desapercibido: siempre deja una jugada para discutir en el tercer tiempo.');
      }

      return pool[stableIndex(`${player.name}|color|${role}|${starTier(overall)}|${starTier(technique)}|${starTier(rhythm)}|${starTier(defense)}|${starTier(attack)}|${starTier(teamwork)}|${starTier(regularity)}|${starTier(goalkeeper)}`, pool.length)];
    };
    const scoutDataFromTrigger = (trigger) => {
      const row = trigger.closest('[data-player-edit-row]');
      if (row) {
        const positions = selectedPositionsInOrder(row);
        const getValue = (field) => numberOr(row.querySelector(`[data-stat-rating-input][name="${field}"]`)?.value, field === 'regularity' ? 3.5 : 3);
        const player = {
          name: row.querySelector('input[name="name"]')?.value || row.querySelector('.player-readonly-name')?.textContent || 'Este jugador',
          positions,
          skill: numberOr(row.querySelector('[data-general-rating-value]')?.textContent, 3),
        };
        scoutStatRules.forEach((rule) => {
          player[rule.field] = getValue(rule.field);
        });
        return player;
      }

      const positions = String(trigger.dataset.playerScoutPositions || '').split('/').map((position) => position.trim()).filter(Boolean);
      const player = {
        name: trigger.dataset.playerScoutName || 'Este jugador',
        positions,
        skill: numberOr(trigger.dataset.playerScoutSkill, 3),
      };
      scoutStatRules.forEach((rule) => {
        player[rule.field] = numberOr(trigger.dataset[datasetStatName(rule.field)], 3);
      });
      return player;
    };
    const describeScoutPlayerLegacy = (player) => {
      const isGoalkeeper = player.positions[0] === 'ARQ';
      const visibleRules = scoutStatRules.filter((rule) => isGoalkeeper
        ? rule.field !== 'attack'
        : rule.field !== 'goalkeeper_skill');
      const stats = visibleRules.map((rule) => ({ ...rule, value: numberOr(player[rule.field], rule.field === 'regularity' ? 3.5 : 3) }));
      const best = stats.slice().sort((a, b) => b.value - a.value)[0];
      const weakest = stats.slice().sort((a, b) => a.value - b.value)[0];
      const role = isGoalkeeper
        ? 'arquero'
        : (player.positions.includes('DEL') ? 'delantero'
          : (player.positions.includes('DEF') ? 'defensor'
            : (player.positions.includes('LAT') ? 'lateral'
              : (player.positions.includes('MED') ? 'mediocampista' : 'comodin'))));
      const overall = numberOr(player.skill, 3);
      const regularity = numberOr(player.regularity, 3.5);
      const spread = Math.max(...stats.map((stat) => stat.value)) - Math.min(...stats.map((stat) => stat.value));
      const pick = (key, pool) => pool[stableIndex(`${player.name}|${key}|${role}|${starTier(overall)}|${best.field}|${weakest.field}`, pool.length)];
      const statText = {
        technique: {
          good: ['la pelota no le quema: la baja, la cuida y puede limpiar una jugada sucia', 'tiene pie para salir del apuro sin reventarla a la avenida', 'cuando le dan un metro, levanta la cabeza y juega con bastante criterio', 'puede darle pausa al equipo cuando todos empiezan a correr como locos'],
          improve: ['si lo apuran, el primer control puede pedir auxilio', 'con marca encima a veces se enreda solo y termina jugando contra la pelota', 'todavia le conviene tocar simple antes de querer inventar la jugada del domingo', 'cuando la pelota viene mordida, puede devolver un problema mas grande del que recibio'],
        },
        rhythm: {
          good: ['tiene piernas para aparecer dos veces en la misma jugada', 'va y vuelve sin hacer teatro, algo que en el fulbito vale oro', 'mete ritmo, persigue y obliga al rival a jugar incomodo', 'si el partido se abre, no desaparece: sigue llegando'],
          improve: ['si lo hacen correr de lado a lado, empieza a mirar la salida', 'en partidos largos puede quedarse con la reserva prendida', 'cuando el ida y vuelta se vuelve una autopista, le cuesta sostener el viaje', 'si lo sacan a perseguir sombras, termina pagando peaje'],
        },
        defense_physical: {
          good: ['mete cuerpo y no regala la zona como si fuera estacionamiento libre', 'en la dividida va con decision y deja claro que por ahi no se pasea gratis', 'sostiene bien el roce y ayuda a que atras no sea una feria', 'es de los que incomodan: no siempre lindo, pero si bastante necesario'],
          improve: ['si le cargan el cuerpo, puede quedar mirando la patente', 'en el choque fuerte todavia le falta sacar mas pecho', 'cuando el rival lo encara con decision, a veces retrocede de mas', 'puede perder alguna dividida de esas que despues se comentan con cara fea'],
        },
        attack: {
          good: ['cerca del arco huele sangre y obliga a que alguien lo siga', 'si le queda una pelota viva, puede convertir una jugada cualquiera en lio', 'pisa zona caliente sin pedir permiso', 'arriba tiene colmillo: capaz toca poco, pero cuando toca lastima'],
          improve: ['en los ultimos metros a veces elige el boton equivocado', 'puede armar bien la jugada y cerrarla como si hubiera apagado la luz', 'con el arco enfrente se apura y deja una puteada flotando', 'necesita afinar la ultima decision para no regalar ataques buenos'],
        },
        teamwork: {
          good: ['juega con los demas, no contra los demas: toca, acompaña y no rompe el circuito', 'entiende cuando soltarla y cuando dar una mano atras', 'hace mejor al equipo porque no se casa con la pelota', 'sin hacer ruido, acomoda la jugada y se muestra para recibir'],
          improve: ['a veces se corta solo y deja a los compañeros pagando', 'cuando toca ayudar sin pelota, puede llegar tarde a la reunion', 'si se enamora de la jugada, el equipo empieza a mirarlo de reojo', 'necesita levantar mas la cabeza para que la pelota no muera siempre en sus pies'],
        },
        regularity: {
          good: ['no vive de una jugada linda: suele repetir una version confiable', 'tiene piso, y eso en un partido parejo vale mas que una pisadita para la tribuna', 'rara vez se cae del todo; aunque no brille, compite', 'lo normal es que entregue algo parecido a lo que promete'],
          improve: ['puede arrancar como figura y terminar buscando su propia sombra', 'todavia mezcla ratos buenos con baches que hacen ruido', 'necesita sostener mas tiempo lo que hace bien', 'cuando baja un cambio, el equipo lo nota y el rival tambien'],
        },
        goalkeeper_skill: {
          good: ['bajo los tres palos se agranda y puede apagar incendios', 'si le llegan, no se esconde: achica, tapa y grita lo justo', 'en el arco puede transformar peligro en alivio', 'cuando se pone serio, el arco parece un poco mas chico'],
          improve: ['si lo bombardean, puede empezar a mirar de reojo a la defensa', 'necesita mandar mas en el area para que no le entren por todos lados', 'en centros y rebotes todavia puede regalar suspenso', 'si la defensa lo abandona, el partido se le puede venir encima'],
        },
      };
      const extraStatText = {
        technique: {
          good: ['tiene ese toque de potrero que no se explica en una planilla', 'si recibe perfilado, puede dejar a uno pagando con una pisada corta', 'no necesita hacer circo para jugar bien: controla y entrega con sentido', 'cuando la jugada viene trabada, encuentra una salida donde otros ven un paredon', 'tiene un pie que invita al pase corto y a la pared', 'si lo dejan pensar, empieza a jugar con la tranquilidad del que sabe donde esta la pelota'],
          improve: ['si recibe de espaldas, a veces parece que la pelota le llega con instrucciones en chino', 'puede querer salir jugando y terminar armando un incendio en su propio patio', 'cuando lo presionan, el lujo se le convierte en tramite peligroso', 'le falta una marcha de calma para no rifarla en la primera incomoda', 'si el pase viene fuerte, la pelota puede salir con destino turistico', 'necesita bajar un cambio: no toda pelota pide firulete'],
        },
        rhythm: {
          good: ['corre con sentido, no a cualquier lado', 'le da velocidad al equipo cuando la pelota pide cambio de marcha', 'puede presionar arriba y volver sin mandar carta documento', 'sostiene el ida y vuelta sin convertir cada pique en una novela', 'tiene motor para romper una jugada que parecia perdida', 'si hay que meter una corrida larga, no se borra'],
          improve: ['necesita elegir mejor cuando acelerar y cuando guardar aire', 'a veces llega a la foto cuando la jugada ya salio en los diarios', 'si el rival lo mueve mucho, lo puede sacar del partido por cansancio', 'en transiciones largas puede quedar lejos, como esperando el colectivo anterior', 'le cuesta repetir esfuerzos sin perder claridad', 'si tiene que correr para atras muchas veces, empieza a negociar con el oxigeno'],
        },
        defense_physical: {
          good: ['tiene oficio para molestar sin hacer falta tonta', 'va al cruce con cara de que la pelota tambien puede sufrir', 'cuando choca, el rival entiende que no vino a una clase de yoga', 'aguanta la posicion y no se mueve con cualquier empujon', 'cierra espacios como quien baja una persiana', 'puede ser ese tipo molesto que nadie quiere tener encima'],
          improve: ['si lo atacan con potencia, puede terminar defendiendo con la mirada', 'necesita meter mas presencia para que no lo pasen por arriba', 'en pelotas divididas a veces entra tarde, como pidiendo permiso', 'cuando el partido se pone aspero, puede quedar demasiado prolijo', 'si lo agarran mal parado, le cuesta recuperar el metro perdido', 'le falta un poco de malicia para cortar antes de que la jugada se haga grande'],
        },
        attack: {
          good: ['se mueve donde duele, entre el defensor distraido y el arquero nervioso', 'tiene olfato para aparecer justo cuando la pelota queda suelta', 'si recibe cerca del area, la jugada deja de ser tranquila', 'no necesita veinte chances: con media puede armar quilombo', 'cuando encara para adelante, obliga a que el rival retroceda con miedo', 'puede transformar un rebote cualquiera en tema de conversacion'],
          improve: ['a veces llega al area y se le mezclan todas las pestanas del navegador', 'puede hacer lo dificil y despues fallar lo que habia que resolver simple', 'cuando queda para definir, a veces patea como si quisiera sacarse el problema de encima', 'le falta serenidad para que la jugada no termine en suspiro', 'si tiene que decidir rapido, puede elegir la peor puerta', 'en ataque suma hasta que la pelota pide sentencia; ahi todavia duda'],
        },
        teamwork: {
          good: ['tiene lectura para hacer la facil, que muchas veces es la mas dificil', 'cuando el equipo se desordena, suele ofrecer una salida', 'no necesita tocar diez veces para sentirse importante', 'si hay que cubrir a un companero, aparece sin pedir aplausos', 'juega mirando camisetas propias, detalle que parece obvio hasta que falta', 'puede ser pegamento: no brilla siempre, pero junta piezas'],
          improve: ['puede confundir protagonismo con quedarse la pelota un turno de mas', 'si no participa, se va del partido como quien se fue a comprar hielo', 'a veces mira la jugada desde afuera cuando tenia que meterse', 'le falta hablar mas con el equipo y menos con su propia idea', 'cuando el partido pide solidaridad, puede aparecer con delay', 'si lo rodean mal, se aisla y empieza a jugar su propio torneo'],
        },
        regularity: {
          good: ['no te obliga a adivinar que jugador va a caer a la cancha', 'puede tener un mal rato, pero no suele regalar el partido entero', 'mantiene la temperatura: ni se prende fuego ni se congela facil', 'es de esos que hacen menos ruido porque casi siempre cumplen', 'si arranca bien, generalmente sostiene el libreto', 'tiene una virtud silenciosa: no desaparece justo cuando el partido aprieta'],
          improve: ['su partido puede venir con dos temporadas en una misma tarde', 'si entra cruzado, tarda en encontrarse y deja huecos en el camino', 'a veces tiene techo de aplauso y piso de silencio incomodo', 'puede pasar de solucion a problema sin pedir permiso', 'necesita que su mejor rato dure mas que un par de jugadas', 'cuando se apaga, no baja la luz: corta la termica'],
        },
        goalkeeper_skill: {
          good: ['tiene reflejos para salvar alguna que ya venia con festejo', 'sale a achicar como si el mano a mano fuera personal', 'puede sostener al equipo cuando atras se arma la mudanza', 'da esa sensacion linda de que no todo tiro termina en drama', 'si la pelota viene sucia, al menos mete dudas en el remate', 'en el arco tiene presencia, y eso al delantero le hace ruido'],
          improve: ['a veces queda a mitad de camino: ni sale ni espera, y ahi todos rezan', 'necesita hablar mas, porque un arquero callado deja dudas gratis', 'en tiros cruzados puede quedar pagando la entrada', 'si el primer remate lo mueve, el segundo ya viene con musica de terror', 'le falta imponer respeto antes de que el delantero se agrande', 'cuando el area se llena, necesita ordenar antes de atajar'],
        },
      };
      Object.entries(extraStatText).forEach(([field, phrases]) => {
        statText[field].good.push(...phrases.good);
        statText[field].improve.push(...phrases.improve);
      });
      const introPool = {
        arquero: [
          `A ${player.name} lo tenes que mirar cuando la pelota quema cerca del arco: ahi se ve si trae calma o si empieza la pelicula de terror.`,
          `${player.name} es de esos que pueden cambiar el humor de una defensa: una buena atajada ordena todo, una duda abre la puerta al caos.`,
          `Con ${player.name}, la historia arranca bajo los tres palos: si entra fino, el equipo respira; si entra torcido, todos miran para atras.`,
        ],
        defensor: [
          `A ${player.name} se lo entiende en la primera dividida: ahi te avisa si vino a ordenar el fondo o a sufrir el partido.`,
          `${player.name} no necesita salir en la foto para pesar; si esta bien parado, el rival empieza a buscar otro camino.`,
          `Con ${player.name}, la pregunta no es si juega lindo: la pregunta es cuanto ensucia la tarde del que tiene enfrente.`,
        ],
        lateral: [
          `A ${player.name} lo tenes que mirar por la banda: ahi se nota si puede ir, volver y seguir pensando.`,
          `${player.name} necesita metros para recorrer y criterio para no dejar la espalda regalada.`,
          `Con ${player.name}, el carril puede ser salida o problema: depende de que tan ordenado quede el ida y vuelta.`,
        ],
        mediocampista: [
          `A ${player.name} hay que mirarlo en el medio del quilombo: si logra jugar ahi, el equipo deja de correr atras de la pelota.`,
          `${player.name} puede ser termometro del partido: cuando participa bien, la jugada respira; cuando se apaga, todo se vuelve mas rustico.`,
          `Con ${player.name}, el partido pasa por una idea simple: tocar, moverse y no convertir cada pelota en una guerra civil.`,
        ],
        delantero: [
          `A ${player.name} lo medis cerca del arco: ahi no hay discurso que salve, o lastima o deja a todos protestando.`,
          `${player.name} vive de esas pelotas que parecen medio muertas y de golpe terminan en una corrida, un rebote o una puteada rival.`,
          `Con ${player.name}, la defensa contraria no puede dormir: capaz toca poco, pero una distraccion y ya esta golpeando la puerta.`,
        ],
        comodin: [
          `A ${player.name} conviene ubicarlo con cariño: en el lugar correcto suma, en el lugar equivocado empieza la novela.`,
          `${player.name} puede tapar varios huecos, pero no es magia: si lo usas mal, el partido le muestra todas las costuras.`,
          `Con ${player.name}, el truco esta en no pedirle cualquier cosa. Dale una funcion clara y puede dejar algo bueno.`,
        ],
      };
      const extraIntroPool = {
        arquero: [
          `${player.name} no juega en el arco, vive ahi un rato: a veces salva, a veces asusta, pero nunca pasa desapercibido.`,
          `Con ${player.name} bajo palos, cada ataque rival tiene olor a examen sorpresa.`,
          `${player.name} tiene ese puesto ingrato donde un error se grita mas que diez buenas; por eso hay que mirarlo con lupa de cancha.`,
          `A ${player.name} lo mide la pelota mas traicionera: la que pica raro, viene tapada y obliga a decidir sin pedir permiso.`,
        ],
        defensor: [
          `${player.name} es de esos que pueden hacerle perder la paciencia al rival sin tocar una pelota linda.`,
          `Si el partido se pone de pierna fuerte y pelota dividida, ahi aparece la verdadera cara de ${player.name}.`,
          `A ${player.name} no lo vendes con highlights; lo vendes con esas jugadas donde el rival se queda sin ganas de encarar.`,
          `${player.name} juega con una idea bastante clara: que el otro no pase comodo, y si pasa, que se acuerde.`,
        ],
        lateral: [
          `${player.name} por banda puede sumar recorrido si no lo dejan defendiendo solo dos canchas.`,
          `A ${player.name} lo define el ida y vuelta: cerrar atras y aparecer cuando el equipo sale.`,
          `Si el partido se abre por los costados, ${player.name} necesita elegir bien cuando pasar y cuando guardarse.`,
          `${player.name} puede ser carrilero util si tiene cobertura y una salida simple cerca.`,
        ],
        mediocampista: [
          `${player.name} vive en la zona donde todos piden la pelota y nadie quiere perderla.`,
          `Si el medio se vuelve una rotonda sin semaforo, ${player.name} puede ordenar o sumarse al embotellamiento.`,
          `A ${player.name} lo define lo que hace cuando recibe rodeado: ahi se separa el jugador del simple voluntarioso.`,
          `${player.name} tiene que jugar donde la pelota pesa, no donde la jugada ya viene resuelta.`,
        ],
        delantero: [
          `${player.name} juega donde no hay paciencia: arriba se perdona poco y se festeja fuerte.`,
          `A ${player.name} hay que juzgarlo en esos metros donde la pelota pide maldad y no explicaciones.`,
          `${player.name} puede pasar un rato quieto y de golpe arruinarle la tarde a un defensor distraido.`,
          `Con ${player.name}, el area tiene otro ruido: capaz no siempre decide bien, pero obliga a mirar.`,
        ],
        comodin: [
          `${player.name} es de esos jugadores que dependen mucho del casillero donde lo pongas.`,
          `A ${player.name} no hay que tirarle cualquier camiseta y esperar magia; necesita un pedido claro.`,
          `${player.name} puede ser parche o solucion, segun lo fino que este el armado del equipo.`,
          `Con ${player.name}, el secreto esta en no hacerlo pagar culpas ajenas: ordenalo y algo devuelve.`,
        ],
      };
      Object.entries(extraIntroPool).forEach(([key, lines]) => {
        introPool[key].push(...lines);
      });
      const fieldZones = {
        technique: ['con la pelota', 'cuando tiene que limpiar la jugada', 'cuando recibe presionado', 'en el primer control', 'cuando el partido pide pausa'],
        rhythm: ['cuando el partido pide piernas', 'en el ida y vuelta', 'cuando hay que repetir esfuerzos', 'en las transiciones largas', 'cuando la jugada se parte'],
        defense_physical: ['en el roce', 'cuando toca disputar', 'en la marca cuerpo a cuerpo', 'cuando hay que cerrar atras', 'en las divididas'],
        attack: ['cerca del arco', 'en los ultimos metros', 'cuando pisa el area', 'cuando la jugada pide veneno', 'de cara al gol'],
        teamwork: ['cuando toca jugar con los demas', 'sin pelota', 'cuando el equipo necesita ayuda', 'en la sociedad con los companeros', 'cuando hay que soltarla'],
        regularity: ['a lo largo del partido', 'cuando hay que sostener el nivel', 'despues de la primera mala', 'cuando el partido se pone raro', 'en la continuidad'],
        goalkeeper_skill: ['bajo los tres palos', 'cuando le llegan limpio', 'en el mano a mano', 'cuando el area se llena', 'en las pelotas que queman'],
      };
      const zoneFor = (field, key) => {
        const pool = fieldZones[field] || ['en esa parte del juego'];
        return pool[stableIndex(`${player.name}|zone|${key}|${field}|${role}|${starTier(numberOr(player[field], 3))}`, pool.length)];
      };
      const bestZone = zoneFor(best.field, 'best');
      const weakZone = zoneFor(weakest.field, 'weak');
      const balancePool = spread <= 0.75
        ? [
          'Su juego sale bastante parejo: no tiene una punta que grite figura, pero tampoco un agujero para que el rival haga fiesta.',
          'No es un jugador de una sola tecla. Tiene un perfil redondo, de esos que ayudan a que el equipo no se parta.',
          'El radar no dibuja montaña rusa: aparece un jugador bastante estable, util para no desordenar el armado.',
        ]
        : spread >= 2.5
          ? [
            `Tiene perfil de especialista: ${bestZone} puede sacar ventaja, pero ${weakZone}, empiezan los problemas.`,
            `El radar lo manda al frente: hay un fuerte claro y tambien una zona donde el rival, si esta despierto, va a ir a buscar sangre.`,
            `No es para usarlo de cualquier cosa. Cerca de su virtud suma; lejos de ahi, puede quedar mas expuesto que defensor sin arquero.`,
          ]
          : [
            `La lectura es simple: cuando aparece ${bestZone}, crece; ${weakZone}, hay que prender una alarma chica.`,
            `No es un caso extremo, pero tiene una firma clara: acercarlo a lo que hace bien y no dejarlo regalado ${weakZone}.`,
            `Tiene cosas para sumar y cosas para hacerte renegar. La gracia esta en ponerlo donde se siente comodo y cubrirlo ${weakZone}.`,
          ];
      if (spread <= 0.75) {
        balancePool.push(
          'El radar sale sin picos raros: jugador de menu completo, no de una sola especialidad.',
          'No trae una virtud de fuegos artificiales, trae varias cosas en tono parejo; eso tambien gana partidos.',
          'Es de esos perfiles que no te rompen el equipo: quizas no enamora, pero tampoco te deja pagando.'
        );
      } else if (spread >= 2.5) {
        balancePool.push(
          `El dibujo del radar parece cartel de advertencia: ${bestZone} suma, ${weakZone} puede hacerte transpirar.`,
          `Tiene una virtud con luces de neon y una deuda que no conviene esconder debajo de la alfombra.`,
          `Usarlo bien es clave: si lo llevas a su zona fuerte, rinde; si lo tiras a su lado flojo, empieza el festival de gestos.`
        );
      } else {
        balancePool.push(
          `El radar no grita crack ni desastre: marca un jugador con una virtud clara y una cuenta pendiente.`,
          `Tiene perfil de fulbito real: una cosa para aplaudir, una para discutir y varias para acomodar.`,
          `La foto general dice que hay material, pero tambien una zona donde el rival puede venir con cuchillo y tenedor.`,
          `No es una ruleta completa: el mapa muestra por donde conviene darle juego y por donde hay que cubrirlo.`,
          `El dibujo deja algo bastante humano: talento en una esquina, deuda en otra y un monton de partido en el medio.`,
          `No viene con manual cerrado. Tiene una virtud que empuja y un costado que puede pedir auxilio si el partido se complica.`,
          `Es un perfil con sabor a cancha chica: si lo acercas a su fuerte, suma; si lo dejas expuesto, aparecen las puteadas.`,
          `El radar no lo condena ni lo corona: simplemente avisa donde puede hacer dano y donde puede pasarla mal.`
        );
      }
      const strengthOpeners = [
        `Su mejor carta aparece ${bestZone}`,
        `Donde mas levanta la mano es ${bestZone}`,
        `Lo que mas le sostiene el partido aparece ${bestZone}`,
        `Si hay que venderlo por una virtud, la foto buena sale ${bestZone}`,
        `El aplauso mas facil se lo gana ${bestZone}`,
        `Cuando la cosa se inclina para su lado, suele empezar ${bestZone}`,
        `La parte linda de su libreto aparece ${bestZone}`,
        `Su argumento mas serio esta ${bestZone}`,
        `Si el equipo lo busca bien, lo encuentra fuerte ${bestZone}`,
        `Donde puede hacer diferencia es ${bestZone}`,
      ];
      const weaknessOpeners = [
        `El costado para apretarlo aparece ${weakZone}`,
        `La grieta aparece ${weakZone}`,
        `Donde puede hacerte agarrar la cabeza es ${weakZone}`,
        `Si el rival lo estudia, lo va a probar ${weakZone}`,
        `La baldosa floja esta ${weakZone}`,
        `El semaforo amarillo se prende ${weakZone}`,
        `El lugar donde puede regalar una novela es ${weakZone}`,
        `Cuando la jugada lo lleva ${weakZone}, se lo nota menos comodo`,
        `La parte que todavia pide laburo aparece ${weakZone}`,
        `Si queres hacerlo dudar, probalo ${weakZone}`,
      ];
      const strengthLine = `${pick(`best-open-${best.field}`, strengthOpeners)}: ${pick(`best-${best.field}`, statText[best.field].good)}.`;
      const weaknessLine = `${pick(`weak-open-${weakest.field}`, weaknessOpeners)}: ${pick(`weak-${weakest.field}`, statText[weakest.field].improve)}.`;
      const regularityPool = regularity >= 4.5
        ? [
          'Encima tiene algo que en el fulbito no sobra: constancia. No vive de un chispazo para despues desaparecer.',
          'Su piso es bueno. Capaz no todos los dias rompe el partido, pero rara vez te deja clavado con cara de "que paso aca".',
          'Tiene continuidad, y eso lo vuelve facil de elegir: sabes mas o menos que jugador va a entrar a la cancha.',
        ]
        : regularity <= 2.5
          ? [
            'La contra es la regularidad: puede arrancar como para pedir camiseta y terminar jugando a escondidas.',
            'Su partido puede venir con sorpresa adentro. Si engancha una buena tarde, suma; si se apaga, hay que salir a buscarlo.',
            'Tiene momentos buenos, pero todavia no firma contrato con la constancia. Te puede dar una alegria y al rato una cana.',
          ]
          : [
            'En regularidad anda por el medio: no es ruleta rusa, pero tampoco escribas su nombre con birome permanente.',
            'Suele cumplir, aunque tiene esos ratos donde baja un cambio y el equipo empieza a mirar alrededor.',
            'Si el contexto lo ayuda, responde mejor. Si el partido se ensucia, puede tener algun tramo de "donde esta".',
          ];
      const closingPool = overall >= 4.5
        ? [
          'Bien rodeado, puede inclinar el partido sin tener que hacer circo. Dale una funcion clara y dejalo trabajar.',
          'Si entra enchufado, es de los que cambian el reparto de fuerzas. Al rival le conviene no regalarle comodidad.',
          'Es jugador para tomar en serio: no hace falta inventarle un altar, pero tampoco conviene dejarlo suelto.',
        ]
        : overall <= 3
          ? [
            'La receta es simple: pocos lujos, pase seguro y no querer salvar la patria en cada pelota.',
            'Puede servir si juega ordenado. Si se cree protagonista de final de Champions, ahi empieza el incendio.',
            'Dale una tarea corta y compañeros cerca. Si lo dejan solo con mucho para resolver, puede salir cualquier cosa.',
          ]
          : [
            'Para armar equipos, sirve si lo pones donde puede sumar y no donde va a sufrir como lateral improvisado.',
            'No es para pedirle milagros ni esconderlo atras de un cono: con una tarea clara, puede dejar una buena tarde.',
            'Usado con criterio, suma. Usado a lo loco, te devuelve el favor con una jugada para discutir despues.',
          ];
      if (regularity >= 4.5) {
        regularityPool.push(
          'Lo bueno es que no suele venir con modo avion: participa, compite y mantiene una linea.',
          'Tiene ese valor invisible de aparecer parecido todos los partidos; en un grupo desparejo, eso cotiza.',
          'Puede tener errores, claro, pero no se le cae la persiana ante la primera mala.'
        );
      } else if (regularity <= 2.5) {
        regularityPool.push(
          'La duda es cual version llega: la que te mejora el equipo o la que te obliga a acomodar todo atras.',
          'Cuando esta fino parece negocio; cuando se desconecta, el equipo empieza a pagar intereses.',
          'Tiene alma de moneda al aire: puede salir cara de figura o cruz de "que hacemos ahora".'
        );
      } else {
        regularityPool.push(
          'No es un misterio total, pero tiene pasajes donde el partido le cambia la cara.',
          'Puede cumplir bien si entra en ritmo; si queda aislado, se le nota enseguida.',
          'Su rendimiento pide contexto: con compania crece, solo contra el mundo empieza a perder gracia.'
        );
      }
      if (overall >= 4.5) {
        closingPool.push(
          'No lo dejes jugar comodo: si agarra confianza, empieza a repartir problemas.',
          'Es de los que conviene poner con gente que entienda la jugada, porque ahi se potencia.',
          'Tiene con que mandar en la cancha; el asunto es que no se crea que tiene que resolver todo solo.'
        );
      } else if (overall <= 3) {
        closingPool.push(
          'Si hace la facil, puede irse aprobado. Si inventa, se arma la feria.',
          'No esta para heroismos: esta para cumplir, ayudar y no rifar la pelota que quema.',
          'En un equipo ordenado puede sobrevivir bien; en un caos, se le ven todas las costuras.'
        );
      } else {
        closingPool.push(
          'Tiene ese punto medio peligroso: bien usado parece importante, mal usado parece que llego tarde.',
          'No te gana solo el partido, pero puede ayudar bastante si no lo mandas a pelear donde peor se siente.',
          'Su mejor version aparece cuando no lo fuerzan a ser otra cosa.'
        );
      }
      const comboPool = [];
      const high = (field) => numberOr(player[field], 3) >= 4.5;
      const low = (field) => numberOr(player[field], 3) <= 2.5;
      if (high('technique') && low('rhythm')) {
        comboPool.push('Tiene pie de salon y motor de sobremesa: si le das tiempo, juega; si lo haces correr, negocia.');
      }
      if (high('rhythm') && low('technique')) {
        comboPool.push('Corre como si llegara tarde, pero con la pelota todavia puede parecer que la viene persiguiendo.');
      }
      if (high('attack') && low('teamwork')) {
        comboPool.push('Arriba puede lastimar, pero a veces juega como si el pase fuera un impuesto.');
      }
      if (high('teamwork') && low('attack')) {
        comboPool.push('Hace jugar a los demas, aunque cuando queda para definir busca companero hasta en la tribuna.');
      }
      if (high('defense_physical') && low('technique')) {
        comboPool.push('Muerde y complica, pero no le pidas salir con moño: lo suyo es ganar la pelota y sacarla viva.');
      }
      if (high('technique') && low('defense_physical')) {
        comboPool.push('Con espacio parece elegante; cuando le ponen el cuerpo, la poesia puede terminar en tramite judicial.');
      }
      if (high('rhythm') && low('defense_physical')) {
        comboPool.push('Tiene piernas para perseguir a cualquiera, aunque a veces corre mucho y muerde poco.');
      }
      if (high('defense_physical') && low('rhythm')) {
        comboPool.push('Parado es una pared; si lo sacan a pasear, la pared empieza a pedir taxi.');
      }
      if (isGoalkeeper && high('goalkeeper_skill') && low('teamwork')) {
        comboPool.push('Ataja, pero necesita hablar mas: un arquero mudo deja a la defensa jugando a las adivinanzas.');
      }
      if (isGoalkeeper && high('goalkeeper_skill') && low('defense_physical')) {
        comboPool.push('Bajo palos responde, pero cuando sale al barro conviene que alguien le cubra la espalda.');
      }
      if (!comboPool.length && best.field !== 'regularity' && weakest.field !== 'regularity') {
        comboPool.push(`El truco es sencillo: hacerlo jugar seguido ${bestZone} y no dejar que el partido lo encierre ${weakZone}.`);
      }
      const comboLine = comboPool.length ? pick('combo', comboPool) : '';
      const titlePool = [
        `${player.name}, a cancha abierta`,
        `Lo de ${player.name}`,
        `${player.name} bajo la lupa del fulbito`,
        `${player.name}, sin cassette`,
        `Radiografia de potrero: ${player.name}`,
      ];
      return {
        title: pick('title', titlePool),
        body: [
          pick('intro', introPool[role] || introPool.comodin),
          pick('balance', balancePool),
          strengthLine,
          weaknessLine,
          comboLine,
          pick('regularity', regularityPool),
          pick('closing', closingPool),
        ].filter(Boolean).join(' '),
        tags: [
          role.toUpperCase(),
          `Fuerte: ${bestZone}`,
          `A cuidar: ${weakZone}`,
          `Regularidad ${qualitativeRating(numberOr(player.regularity, 3.5))}`,
        ],
      };
    };
    const describeScoutPlayer = (player) => {
      const isGoalkeeper = player.positions[0] === 'ARQ';
      const role = isGoalkeeper
        ? 'arquero'
        : (player.positions.includes('DEL') ? 'delantero'
          : (player.positions.includes('DEF') ? 'defensor'
            : (player.positions.includes('LAT') ? 'lateral'
              : (player.positions.includes('MED') ? 'mediocampista' : 'comodin'))));
      const visibleRules = scoutStatRules.filter((rule) => isGoalkeeper
        ? rule.field !== 'attack'
        : rule.field !== 'goalkeeper_skill');
      const stats = visibleRules.map((rule) => ({
        ...rule,
        label: rule.field === 'goalkeeper_skill' ? 'Arco' : rule.label,
        value: numberOr(player[rule.field], rule.field === 'regularity' ? 3.5 : 3),
      }));
      const roleStrengthPriority = {
        arquero: ['goalkeeper_skill', 'regularity', 'mentality', 'teamwork', 'rhythm', 'defense_physical', 'technique'],
        defensor: ['defense_physical', 'rhythm', 'mentality', 'regularity', 'technique', 'teamwork', 'attack'],
        lateral: ['rhythm', 'defense_physical', 'teamwork', 'technique', 'regularity', 'attack', 'mentality'],
        mediocampista: ['teamwork', 'technique', 'rhythm', 'regularity', 'mentality', 'attack', 'defense_physical'],
        delantero: ['attack', 'rhythm', 'technique', 'mentality', 'regularity', 'teamwork', 'defense_physical'],
        comodin: ['regularity', 'teamwork', 'rhythm', 'technique', 'mentality', 'defense_physical', 'attack'],
      };
      const roleWeaknessPriority = {
        arquero: ['goalkeeper_skill', 'teamwork', 'mentality', 'technique', 'rhythm', 'defense_physical', 'regularity'],
        defensor: ['defense_physical', 'teamwork', 'technique', 'rhythm', 'mentality', 'regularity', 'attack'],
        lateral: ['rhythm', 'defense_physical', 'teamwork', 'technique', 'attack', 'regularity', 'mentality'],
        mediocampista: ['teamwork', 'technique', 'rhythm', 'mentality', 'regularity', 'defense_physical', 'attack'],
        delantero: ['attack', 'teamwork', 'rhythm', 'technique', 'mentality', 'regularity', 'defense_physical'],
        comodin: ['teamwork', 'regularity', 'technique', 'rhythm', 'mentality', 'defense_physical', 'attack'],
      };
      const priorityIndex = (pool, field) => {
        const index = (pool || []).indexOf(field);
        return index === -1 ? 99 : index;
      };
      const sortedHigh = stats.slice().sort((a, b) => (
        b.value - a.value
        || priorityIndex(roleStrengthPriority[role], a.field) - priorityIndex(roleStrengthPriority[role], b.field)
        || a.label.localeCompare(b.label)
      ));
      const sortedLow = stats.slice().sort((a, b) => (
        a.value - b.value
        || priorityIndex(roleWeaknessPriority[role], a.field) - priorityIndex(roleWeaknessPriority[role], b.field)
        || a.label.localeCompare(b.label)
      ));
      const best = sortedHigh[0];
      let weakest = sortedLow[0];
      const weakestCandidates = stats.filter((stat) => stat.value === sortedLow[0].value);
      const contrastWeaknessPriority = (() => {
        if (role === 'defensor' && best.field === 'defense_physical') return ['attack', 'technique', 'teamwork', 'rhythm'];
        if (role === 'delantero' && best.field === 'attack') return ['teamwork', 'rhythm', 'technique', 'mentality'];
        if (role === 'mediocampista' && ['technique', 'teamwork'].includes(best.field)) return ['defense_physical', 'attack', 'rhythm', 'mentality'];
        if (role === 'arquero' && best.field === 'goalkeeper_skill') return ['teamwork', 'technique', 'rhythm', 'mentality'];
        return null;
      })();
      if (contrastWeaknessPriority && weakestCandidates.length > 1) {
        weakest = weakestCandidates.slice().sort((a, b) => (
          priorityIndex(contrastWeaknessPriority, a.field) - priorityIndex(contrastWeaknessPriority, b.field)
          || priorityIndex(roleWeaknessPriority[role], a.field) - priorityIndex(roleWeaknessPriority[role], b.field)
        ))[0];
      }
      const overall = numberOr(player.skill, 3);
      const overallCard = cardOverallFromSix(overall);
      const roleLabel = roleDisplayLabels[role] || role;
      const regularity = numberOr(player.regularity, 3.5);
      const spread = Math.max(...stats.map((stat) => stat.value)) - Math.min(...stats.map((stat) => stat.value));
      const hasRealWeakness = weakest.value <= 2.5 || spread >= 1.5;
      const naturalJoin = (items) => items.length <= 1
        ? (items[0] || '')
        : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
      const qualitativeStatSentenceText = (stat) => {
        const text = qualitativeStatText(stat).toLowerCase();
        const article = ['Tecnica', 'Solidez', 'Mentalidad', 'Regularidad'].includes(stat.label) ? 'la' : 'el';
        return `${article} ${text}`;
      };
      const statAreaText = (stat) => ({
        technique: 'la tecnica',
        rhythm: 'el ritmo',
        defense_physical: 'la solidez',
        attack: 'el ataque',
        teamwork: 'el juego en equipo',
        mentality: 'la mentalidad',
        regularity: 'la regularidad',
        goalkeeper_skill: 'el arco',
      }[stat.field] || stat.label.toLowerCase());
      const pick = (key, pool) => pool[stableIndex(`${player.name}|${key}|${role}|${overallCard}|${best.field}|${weakest.field}`, pool.length)];
      const fieldZones = {
        technique: 'con la pelota',
        rhythm: 'en el ritmo',
        defense_physical: 'en la solidez',
        attack: 'en ataque',
        teamwork: 'en el juego colectivo',
        mentality: 'en la cabeza',
        regularity: 'en la regularidad',
        goalkeeper_skill: 'bajo los tres palos',
      };
      const fieldUseLabels = {
        technique: 'su juego con pelota',
        rhythm: 'su ritmo',
        defense_physical: 'su solidez',
        attack: 'su ataque',
        teamwork: 'su juego colectivo',
        mentality: 'su cabeza',
        regularity: 'su regularidad',
        goalkeeper_skill: 'su seguridad bajo los tres palos',
      };
      const fieldRiskLabels = {
        technique: 'cuando recibe presionado',
        rhythm: 'cuando el partido lo obliga a correr largo',
        defense_physical: 'en duelos fisicos fuertes',
        attack: 'cuando tiene que resolver cerca del arco',
        teamwork: 'cuando la jugada pide asociarse rapido',
        mentality: 'cuando el partido se ensucia',
        regularity: 'cuando necesita sostener el nivel todo el partido',
        goalkeeper_skill: 'cuando queda exigido bajo los tres palos',
      };
      const statSemantics = {
        technique: {
          high: ['recibe y decide con limpieza', 'puede darle pausa a una jugada que viene sucia', 'no necesita reventarla para salir del apuro'],
          max: ['la tecnica esta al maximo: si le dan medio metro, la pelota empieza a obedecerle'],
          low: ['cuando lo presionan, el control puede convertir una pelota simple en problema', 'si recibe incomodo, le conviene resolver facil y no inventar'],
        },
        rhythm: {
          high: ['sostiene ida y vuelta sin perder presencia', 'llega a jugadas que parecian perdidas', 'acelera el partido y obliga al rival a correr para atras'],
          max: ['el ritmo es excelente: tiene motor para repetir esfuerzos y romper el partido por desgaste'],
          low: ['si el partido se abre mucho, puede quedarse lejos de la jugada', 'cuando lo hacen correr largo, empieza a pagar el esfuerzo'],
        },
        defense_physical: {
          high: ['compite fuerte en el roce y no regala metros', 'en la dividida deja claro que por ahi no se pasa gratis', 'sostiene la marca y ayuda a cerrar atras'],
          max: ['la solidez es excelente: en el choque y la marca tiene peso de jugador serio'],
          low: ['si lo atacan con cuerpo, puede quedar demasiado liviano', 'en duelos fisicos fuertes necesita ayuda cerca'],
        },
        attack: {
          high: ['cerca del arco toma mejores decisiones que el promedio', 'si pisa zona caliente, obliga a que lo sigan', 'puede transformar una pelota viva en peligro real'],
          max: ['el ataque es excelente: cuando aparece cerca del arco, el rival tiene que ajustar todo'],
          low: ['en los ultimos metros le falta veneno', 'puede participar bien y apagarse justo cuando toca terminar la jugada'],
        },
        teamwork: {
          high: ['juega mirando al equipo, no solo su jugada', 'suelta la pelota a tiempo y se ofrece de nuevo', 'ayuda a que la estructura no se parta'],
          max: ['el juego en equipo es excelente: conecta lineas, ayuda sin pelota y mejora al de al lado'],
          low: ['a veces se corta solo y el equipo queda largo', 'si la jugada pide solidaridad, puede llegar tarde o elegir de mas'],
        },
        mentality: {
          high: ['compite con foco y no se cae ante la primera mala', 'sostiene el caracter cuando el partido se ensucia', 'tiene temple para seguir jugando aunque el contexto apriete'],
          max: ['la mentalidad es excelente: cuando el partido quema, no se esconde'],
          low: ['si lo sacan del eje, tarda en volver al partido', 'cuando algo sale mal, puede perder foco y contagiar desorden'],
        },
        regularity: {
          high: ['suele repetir una version confiable', 'no depende de un solo chispazo para justificar su lugar', 'tiene un piso de rendimiento que ordena al equipo'],
          max: ['la regularidad es excelente: casi siempre entrega lo que promete en cancha'],
          low: ['puede tener un rato muy bueno y despues desaparecer', 'su rendimiento todavia cambia demasiado de un tramo a otro'],
        },
        goalkeeper_skill: {
          high: ['responde cuando le llegan y puede ordenar el area', 'bajo palos transmite mas calma que susto', 'achica bien y puede salvar una jugada que venia complicada'],
          max: ['el arco es excelente: bajo los tres palos puede sostener un partido entero'],
          low: ['si lo bombardean, puede empezar a regalar dudas', 'en centros, rebotes o mano a mano necesita mas seguridad'],
        },
      };
      const semanticLine = (stat, tone, key) => {
        const semantics = statSemantics[stat.field] || statSemantics.mentality;
        const pool = semantics[tone] || semantics.high;
        return pick(`${key}-${stat.field}-${tone}`, pool);
      };
      const sentenceCase = (text) => text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
      const statSubject = (stat) => stat.field === 'goalkeeper_skill' ? 'El arco' : stat.label;
      const maxStats = stats.filter((stat) => stat.value >= 5.95);
      const lowStats = stats.filter((stat) => stat.value <= 2);
      const bestQuality = qualitativeRating(best.value);
      const weakestQuality = qualitativeRating(weakest.value);
      const roleOpeners = {
        arquero: [
          `${player.name} es un arquero de contexto: necesita que el equipo reduzca el caos cerca del area.`,
          `${player.name} se entiende mejor bajo los tres palos cuando no queda atajando urgencias todo el tiempo.`,
        ],
        defensor: [
          `${player.name} es un defensor de rol claro: necesita una tarea concreta para rendir con sentido.`,
          `${player.name} puede sumar como defensor si el equipo le da orden y no lo usa como solucion para todo.`,
        ],
        lateral: [
          `${player.name} es un lateral para jugar con cobertura y recorridos medidos.`,
          `${player.name} puede rendir por banda si el equipo le marca cuando pasar y cuando cerrar.`,
        ],
        mediocampista: [
          `${player.name} es un mediocampista para jugar con apoyos cerca y una tarea bien definida.`,
          `${player.name} puede ordenar desde el medio si no lo obligan a resolver cada pelota como una emergencia.`,
        ],
        delantero: [
          `${player.name} es un delantero de intervenciones simples dentro del ataque.`,
          `${player.name} se entiende mejor como delantero de rol definido, no como solucion para todo el frente.`,
        ],
        comodin: [
          `${player.name} es un comodin de contexto: sirve cuando la funcion esta clara y no lo tiran a cualquier lado.`,
          `${player.name} puede ser util en varios lugares, pero necesita una consigna precisa para no diluirse.`,
        ],
      };
      const shapeLine = best.value < 4
        ? 'Su perfil no muestra un arma dominante; por eso necesita un rol simple y bien acompanado.'
        : spread <= 1.25
        ? pick('shape-even', [
          'Su perfil es bastante parejo: tiene una punta interesante, pero no una grieta clara que obligue a esconderlo.',
          'La lectura general es estable: hay un rasgo que suma, sin que el resto pida una cobertura especial.',
          'No es un perfil extremo: ofrece algo reconocible y mantiene el resto dentro de una zona manejable.',
        ])
        : best.value >= 5.95
          ? 'Su perfil es marcado: tiene una virtud muy fuerte y una zona que pide cuidado.'
        : spread >= 2.5
          ? 'Su perfil es marcado: hay una diferencia clara entre lo que resuelve y lo que necesita cobertura.'
          : 'Su perfil tiene una direccion clara: puede sumar si el equipo lo acompana y le ordena la tarea.';
      const strengthLine = best.value >= 4
        ? (best.value >= 5.95
          ? sentenceCase(semanticLine(best, 'max', 'best')) + '.'
          : `${statSubject(best)} aparece como rasgo ${bestQuality}: ${semanticLine(best, 'high', 'best')}.`)
        : `Dentro de un perfil sin grandes picos, lo mas aprovechable es su ${best.label.toLowerCase()}: puede darle algo de orden si el rol es simple.`;
      const weaknessLine = hasRealWeakness
        ? (weakest.value <= 2.5
          ? `${statSubject(weakest)} es el punto bajo: ${semanticLine(weakest, 'low', 'weak')}.`
          : `${statSubject(weakest)} es la zona a cuidar: tiene nivel ${weakestQuality}, asi que no conviene hacerlo depender de eso.`)
        : 'El resto queda en zona media: no hay una alarma clara, pero tampoco margen para cargarle todo el equipo.';
      const extraLowStats = lowStats.filter((stat) => stat.field !== weakest.field);
      const extraMaxStats = maxStats.filter((stat) => stat.field !== best.field);
      const maxLine = extraMaxStats.length
        ? `Tambien muestra rasgos excelentes en ${naturalJoin(extraMaxStats.map(statAreaText))}.`
        : '';
      const lowLine = extraLowStats.length
        ? `Ademas, ${naturalJoin(extraLowStats.map(qualitativeStatSentenceText))} tambien ${extraLowStats.length === 1 ? 'pide' : 'piden'} cobertura.`
        : '';
      const regularityLine = best.field === 'regularity' || weakest.field === 'regularity'
        ? ''
        : regularity >= 4.5
          ? 'La regularidad ayuda: lo bueno que tiene suele repetirse y eso lo vuelve mas confiable.'
          : regularity <= 2.5
            ? 'La regularidad preocupa: puede alternar buenos momentos con baches que obligan a reordenar el equipo.'
            : '';
      const comboLine = (() => {
        const high = (field) => numberOr(player[field], 3) >= 4.5;
        const low = (field) => numberOr(player[field], 3) <= 2.5;
        const combos = [];
        if (high('technique') && low('rhythm')) combos.push('Tiene pie para pensar la jugada, pero no conviene hacerlo vivir a pura corrida.');
        if (high('rhythm') && low('technique')) combos.push('Tiene piernas para llegar, aunque con la pelota necesita elegir simple.');
        if (high('attack') && low('teamwork')) combos.push('Puede lastimar arriba, pero si no levanta la cabeza el equipo pierde fluidez.');
        if (high('teamwork') && low('attack')) combos.push('Hace jugar a los demas, aunque cerca del arco todavia le falta decision.');
        if (high('defense_physical') && low('technique')) combos.push('Gana duelos, pero despues necesita una salida limpia cerca para no rifarla.');
        if (high('technique') && low('defense_physical')) combos.push('Con espacio juega, con roce puede sufrir; hay que protegerlo de la friccion constante.');
        if (isGoalkeeper && high('goalkeeper_skill') && low('teamwork')) combos.push('Ataja, pero le conviene hablar mas con la defensa para que el area no sea improvisacion.');
        return combos.length ? pick('combo', combos) : '';
      })();
      const tacticalAdvice = {
        technique: 'En el armado, conviene darle pases simples y evitar que reciba siempre de espaldas o apurado.',
        rhythm: 'En el armado, no conviene pedirle recorridos largos todo el tiempo: mejor apoyos cerca y movimientos cortos.',
        defense_physical: 'En el armado, necesita ayuda en el roce y no quedar aislado contra rivales pesados.',
        attack: 'En el armado, mejor que participe antes de la definicion y no cargarle siempre la ultima decision.',
        teamwork: 'En el armado, necesita companeros cerca y opciones claras para no cortar la circulacion.',
        mentality: 'En el armado, conviene bajarle el ruido alrededor y darle decisiones simples cuando el partido se caliente.',
        regularity: 'En el armado, conviene medirlo por tramos: si arranca bien, sostenerle el contexto; si arranca torcido, simplificarle la tarea.',
        goalkeeper_skill: 'En el armado, necesita defensa comunicada y no quedar expuesto a bombardeos constantes.',
      };
      const balancedAdvice = {
        arquero: 'En el armado, le conviene una defensa ordenada y salidas simples para no convertir cada pelota en urgencia.',
        defensor: 'En el armado, conviene darle una funcion limpia y referencias cerca para que juegue sin sobreactuar.',
        lateral: 'En el armado, conviene darle cobertura por dentro para que pueda recorrer la banda sin partir al equipo.',
        mediocampista: 'En el armado, suma mas si recibe con opciones cercanas y no con todo el equipo partido.',
        delantero: 'En el armado, rinde mejor con movimientos claros y companeros que le acerquen la jugada.',
        comodin: 'En el armado, necesita una consigna concreta para que su utilidad no quede repartida en demasiadas tareas.',
      };
      const tacticalLine = hasRealWeakness && !comboLine
        ? tacticalAdvice[weakest.field]
        : balancedAdvice[role];
      const closingPool = overallCard >= 85
        ? [
          'Conclusion: jugador para tomar decisiones alrededor de el. No hay que inventarle un altar, pero si darle contexto para que pese.',
          'Resumen: si entra concentrado, es de los que cambian el reparto de fuerzas. El rival no deberia dejarlo comodo.',
          'Cierre claro: perfil fuerte, rasgos claros y capacidad de impacto. El equipo tiene que usarlo, no mirarlo.',
        ]
        : lowStats.length
          ? [
            'Conclusion: puede sumar, pero el plan tiene que asumir esa alerta desde el inicio.',
            'Resumen: es util si el partido no lo obliga a vivir justo en la zona que mas le cuesta.',
            'Cierre claro: simplificarle el recorrido y rodearlo bien cuando aparezca la dificultad.',
          ]
          : [
            'Conclusion: buen perfil de uso si la consigna es clara y no se le pide jugar contra su naturaleza.',
            'Resumen: no hay que exagerarlo ni subestimarlo; funciona cuando el plan le ordena las decisiones.',
            'Cierre claro: rol definido, apoyos cerca y decisiones simples.',
          ];
      const titlePool = overallCard >= 85
        ? [`${player.name}, ficha pesada`, `${player.name} en zona elite`, `Informe fuerte: ${player.name}`]
        : [`${player.name}, lectura de cancha`, `Informe de ${player.name}`, `${player.name} bajo la lupa`];

      return {
        title: pick('title', titlePool),
        body: [
          pick('intro', roleOpeners[role] || roleOpeners.comodin),
          shapeLine,
          strengthLine,
          maxLine,
          weaknessLine,
          lowLine,
          comboLine,
          regularityLine,
          tacticalLine,
          pick('closing', closingPool),
        ].filter(Boolean).join(' '),
        tags: [
          roleLabel.toUpperCase(),
          `Fuerte: ${qualitativeStatText(best)}`,
          hasRealWeakness ? `A cuidar: ${qualitativeStatText(weakest)}` : 'Sin grieta marcada',
          ...(extraMaxStats.length ? [`Excelente: ${extraMaxStats.map((stat) => stat.label).join(', ')}`] : []),
          ...(extraLowStats.length ? [`Alerta: ${extraLowStats.map((stat) => stat.label).join(', ')}`] : []),
        ],
      };
    };
    const renderPlayerInfoScout = (scope) => {
      const panel = scope.querySelector('[data-player-info-scout]');
      if (!panel) return;
      const scout = describeScoutPlayer(scoutDataFromTrigger(scope));
      const title = panel.querySelector('[data-player-info-scout-title]');
      const body = panel.querySelector('[data-player-info-scout-body]');
      const tags = panel.querySelector('[data-player-info-scout-tags]');
      if (title) title.textContent = scout.title;
      if (body) body.textContent = scout.body;
      if (tags) {
        tags.innerHTML = scout.tags.map((tag) => `<span class="rounded-full border border-lime-200/45 bg-lime-100 px-2.5 py-1 text-xs font-extrabold text-[#07130f]">${tag}</span>`).join('');
      }
    };
    const togglePlayerInfoScout = (button) => {
      const panel = button.closest('[data-player-info-scout]');
      if (!panel) return;
      const isCollapsed = panel.getAttribute('data-player-info-scout-collapsed') !== '0';
      panel.setAttribute('data-player-info-scout-collapsed', isCollapsed ? '0' : '1');
      button.textContent = isCollapsed ? '-' : '+';
      button.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
      button.setAttribute('aria-label', isCollapsed ? 'Compactar relato' : 'Expandir relato');
    };
    const playerNameFromScope = (scope) => {
      const readonlyName = scope.querySelector('.player-readonly-name')?.textContent;
      const inputName = scope.querySelector('input[name="name"]')?.value;
      const mobileName = scope.querySelector('.mobile-player-list-item strong, .mobile-player-view-summary strong')?.textContent;
      return (readonlyName || inputName || mobileName || 'Jugador').trim();
    };
    const openPlayerRadarPanel = (trigger) => {
      const scope = trigger.closest('tr[data-player-edit-row], .mobile-player-profile-panel, form.player-edit-panel, form.player-create-body');
      const sourceCard = trigger.closest('[data-player-radar]');
      const panel = document.querySelector('[data-player-radar-panel]');
      if (!scope || !sourceCard || !panel) return;
      renderPlayerRadar(scope);
      const sourceSvg = sourceCard.querySelector('svg');
      const canvas = panel.querySelector('[data-player-radar-large-canvas]');
      const statsTarget = panel.querySelector('[data-player-radar-stats]');
      const title = panel.querySelector('[data-player-radar-title]');
      if (!sourceSvg || !canvas || !statsTarget || !title) return;

      title.textContent = playerNameFromScope(scope);
      const svg = sourceSvg.cloneNode(true);
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.classList.add('player-radar-large-svg');
      canvas.replaceChildren(svg);

      const hasGoalkeeper = hasPrimaryGoalkeeper(scope);
      const fields = hasGoalkeeper ? statNames.map((field) => field === 'attack' ? 'goalkeeper_skill' : field) : statNames;
      statsTarget.innerHTML = fields.map((field) => {
        const value = Number(scope.querySelector(`[data-stat-rating-input][name="${field}"]`)?.value || (field === 'regularity' ? 3.5 : 3));
        const percent = Math.max(0, Math.min(100, Math.round((value / 6) * 100)));
        return `
          <div class="player-radar-floating-stat rounded-xl border border-lime-200/30 bg-emerald-950/70 px-3 py-2">
            <div class="mb-1 flex items-center justify-between gap-2">
              <span class="text-[11px] font-extrabold uppercase text-lime-100">${radarLabels[field]}</span>
              <strong class="rounded-full bg-lime-100 px-2 py-0.5 text-[10px] font-black text-[#07130f]" title="${formatRating(value)}/6">${cardOverallFromSix(value)}</strong>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-emerald-900">
              <span class="block h-full rounded-full" style="width:${percent}%; background-color:${statBarColor(value)}"></span>
            </div>
          </div>
        `;
      }).join('');
      panel.hidden = false;
    };
    const closePlayerRadarPanel = () => {
      const panel = document.querySelector('[data-player-radar-panel]');
      if (panel) panel.hidden = true;
    };
    const compactRadarSelector = '.players-desktop-table .player-radar-card-compact, .players-user-table .player-radar-card-compact';

    const radarPoint = (centerX, centerY, radius, index, total) => {
      const angle = (-Math.PI / 2) + (Math.PI * 2 * index / total);
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    };
    const selectedPositionsInOrder = (scope) => {
      const selects = Array.from(scope.querySelectorAll('select[name="positions[]"]'));
      const raw = selects.length
        ? selects.map((select) => select.value)
        : Array.from(scope.querySelectorAll('input[name="positions[]"]:checked')).map((input) => input.value);
      return raw.filter((position, index, list) => position && list.indexOf(position) === index).slice(0, 2);
    };
    const hasPrimaryGoalkeeper = (scope) => selectedPositionsInOrder(scope)[0] === 'ARQ';
    const syncPositionSelectOptions = (scope) => {
      const selects = Array.from(scope.querySelectorAll('select[name="positions[]"]'));
      if (!selects.length) return;
      const selected = selects.map((select) => select.value).filter(Boolean);
      selects.forEach((select) => {
        Array.from(select.options).forEach((option) => {
          option.disabled = option.value !== '' && option.value !== select.value && selected.includes(option.value);
        });
      });
      const positionLabel = scope.querySelector('[data-general-card-position]');
      if (positionLabel) {
        positionLabel.textContent = selectedPositionsInOrder(scope).join(' / ');
      }
    };

    const renderPlayerRadar = (scope) => {
      const card = scope.querySelector('[data-player-radar]');
      const canvas = scope.querySelector('[data-player-radar-canvas]');
      if (!card || !canvas) return;

      const getValue = (name) => Number(scope.querySelector(`[data-stat-rating-input][name="${name}"]`)?.value || (name === 'regularity' ? 3.5 : 3));
      const hasGoalkeeper = hasPrimaryGoalkeeper(scope);
      const fields = hasGoalkeeper ? statNames.map((field) => field === 'attack' ? 'goalkeeper_skill' : field) : statNames;
      const isCompact = card.classList.contains('player-radar-card-compact');
      const isProfileCard = Boolean(card.closest('.profile-player-panel'));
      const useShortLabels = isCompact || isProfileCard || window.matchMedia('(max-width: 760px)').matches;
      const labels = useShortLabels ? radarShortLabels : radarLabels;
      const size = isCompact ? 200 : 240;
      const viewBoxHeight = isCompact ? 212 : 278;
      const centerX = size / 2;
      const centerY = isCompact ? 96 : 112;
      const maxRadius = isCompact ? 56 : 78;
      const labelRadius = isCompact ? 78 : 103;
      const scaleY = isCompact ? viewBoxHeight - 10 : viewBoxHeight - 14;
      const levels = [1, 2, 3, 4, 5, 6];
      const polygon = fields.map((field, index) => {
        const value = Math.max(1, Math.min(6, getValue(field)));
        const point = radarPoint(centerX, centerY, maxRadius * (value / 6), index, fields.length);
        return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      }).join(' ');

      canvas.innerHTML = `
        <svg class="player-radar-svg" viewBox="0 0 ${size} ${viewBoxHeight}" role="img" aria-label="Diagrama de stats">
          <g class="radar-grid">
            ${levels.map((level) => {
              const radius = maxRadius * (level / 6);
              const points = fields.map((_, index) => {
                const point = radarPoint(centerX, centerY, radius, index, fields.length);
                return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
              }).join(' ');
              return `<polygon points="${points}"></polygon>`;
            }).join('')}
          </g>
          <g class="radar-axis">
            ${fields.map((field, index) => {
              const end = radarPoint(centerX, centerY, maxRadius, index, fields.length);
              const label = radarPoint(centerX, centerY, labelRadius, index, fields.length);
              const anchor = Math.abs(label.x - centerX) < 8 ? 'middle' : (label.x > centerX ? 'start' : 'end');
              return `
                <line x1="${centerX}" y1="${centerY}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}"></line>
                <text x="${label.x.toFixed(1)}" y="${label.y.toFixed(1)}" text-anchor="${anchor}">${labels[field]}</text>
              `;
            }).join('')}
          </g>
          <polygon class="radar-shape" points="${polygon}"></polygon>
          <g class="radar-points">
            ${fields.map((field, index) => {
              const value = Math.max(1, Math.min(6, getValue(field)));
              const point = radarPoint(centerX, centerY, maxRadius * (value / 6), index, fields.length);
              return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4"><title>${radarLabels[field]} ${value}/6</title></circle>`;
            }).join('')}
          </g>
          <text class="radar-scale" x="${centerX}" y="${scaleY}" text-anchor="middle">Escala 1 a 6 puntos</text>
        </svg>
      `;
      card.hidden = false;
    };

    const ratingStars = (value) => {
      const rounded = Math.max(1, Math.min(6, Number(value) || 1));
      const filled = Math.round(rounded);
      return `${'\u2605'.repeat(filled)}${'\u2606'.repeat(Math.max(0, 6 - filled))}`;
    };

    const weightsByPosition = {
      ARQ: {
        goalkeeper_skill: 0.42,
        defense_physical: 0.14,
        rhythm: 0.10,
        technique: 0.10,
        teamwork: 0.14,
        mentality: 0.10,
      },
      DEF: {
        defense_physical: 0.28,
        rhythm: 0.20,
        technique: 0.18,
        teamwork: 0.13,
        mentality: 0.13,
        attack: 0.08,
      },
      LAT: {
        rhythm: 0.24,
        defense_physical: 0.22,
        technique: 0.17,
        teamwork: 0.15,
        attack: 0.12,
        mentality: 0.10,
      },
      MED: {
        technique: 0.24,
        rhythm: 0.23,
        teamwork: 0.19,
        mentality: 0.13,
        defense_physical: 0.12,
        attack: 0.09,
      },
      DEL: {
        attack: 0.31,
        rhythm: 0.20,
        technique: 0.17,
        teamwork: 0.14,
        mentality: 0.10,
        defense_physical: 0.08,
      },
    };

    const positionRatingForScope = (scope, position) => {
      const getValue = (name) => Number(scope.querySelector(`[data-stat-rating-input][name="${name}"]`)?.value || (name === 'regularity' ? 3.5 : 3));
      const normalizedPosition = String(position || 'MED').toUpperCase();
      const weights = weightsByPosition[normalizedPosition] || weightsByPosition.MED;
      const raw = Object.entries(weights).reduce((total, [field, weight]) => total + (getValue(field) * weight), 0);
      const regularityFactor = 1 + ((getValue('regularity') - 3.5) / 50);
      return Math.max(1, Math.min(6, Math.round(raw * regularityFactor * 10) / 10));
    };

    const updatePositionSimulation = (scope) => {
      const select = scope.querySelector('[data-position-simulation-select]');
      if (!select) return;
      const fallbackPosition = selectedPositionsInOrder(scope)[0] || 'MED';
      const selectedPosition = select.value || fallbackPosition;
      if (!select.value && fallbackPosition) {
        select.value = fallbackPosition;
      }
      const rating = positionRatingForScope(scope, selectedPosition);
      const ratingValue = scope.querySelector('[data-position-simulation-six]');
      const cardValue = scope.querySelector('[data-position-simulation-card]');
      const stars = scope.querySelector('[data-position-simulation-stars]');
      if (ratingValue) ratingValue.textContent = `${formatRating(rating)}/6`;
      if (cardValue) cardValue.textContent = String(cardOverallFromSix(rating));
      if (stars) stars.textContent = ratingStars(rating);
    };

    const updateGeneralRating = (scope) => {
      const general = scope.querySelector('[data-general-rating]');
      if (!general) {
        updatePositionSimulation(scope);
        renderPlayerRadar(scope);
        return;
      }

      const primaryPosition = selectedPositionsInOrder(scope)[0] || (hasPrimaryGoalkeeper(scope) ? 'ARQ' : 'MED');
      const rounded = positionRatingForScope(scope, primaryPosition);

      const value = general.querySelector('[data-general-rating-value]');
      const stars = general.querySelector('[data-general-rating-stars]');
      if (value) value.textContent = `${formatRating(rounded)}/6`;
      if (stars) stars.textContent = ratingStars(rounded);
      const cardValue = scope.querySelector('[data-general-card-value]');
      if (cardValue) cardValue.textContent = String(cardOverallFromSix(rounded));
      updatePositionSimulation(scope);
      renderPlayerRadar(scope);
    };

    const setRating = (root, value) => {
      const rating = normalizeSixRating(value);
      const input = root.querySelector('[data-stat-rating-input]');
      const label = root.querySelector('[data-stat-rating-value]');
      const previous = input?.value;
      if (input) {
        input.value = String(rating);
        if (previous !== input.value) {
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      if (label) {
        label.textContent = String(cardOverallFromSix(rating));
        label.setAttribute('title', `${formatRating(rating)}/6`);
      }
      const range = root.querySelector('[data-stat-rating-range]');
      if (range) range.value = String(rating);
      const bar = root.querySelector('[data-stat-rating-bar]');
      if (bar) {
        bar.style.width = `${Math.max(0, Math.min(100, Math.round((rating / 6) * 100)))}%`;
        bar.style.backgroundColor = statBarColor(rating);
      }
      root.querySelectorAll('[data-stat-value]').forEach((button) => {
        const current = Number(button.getAttribute('data-stat-value') || '0');
        const active = current <= rating;
        button.classList.toggle('is-active', active);
        button.classList.toggle('text-[#f5b625]', active);
        button.classList.toggle('text-[#c6d3ce]', !active);
        button.setAttribute('aria-checked', current === rating ? 'true' : 'false');
      });
      root.querySelectorAll('[data-stat-rating-range]').forEach((range) => {
        range.setAttribute('aria-valuenow', String(rating));
      });
    };

    document.querySelectorAll('[data-stat-rating]').forEach((root) => {
      const input = root.querySelector('[data-stat-rating-input]');
      setRating(root, input?.value || 3);
      if (root.hasAttribute('data-stat-rating-readonly')) {
        return;
      }
      root.querySelectorAll('[data-stat-rating-range]').forEach((range) => {
        range.addEventListener('input', () => setRating(root, range.value));
        range.addEventListener('change', () => setRating(root, range.value));
      });
      root.querySelectorAll('[data-stat-value]').forEach((button) => {
        button.addEventListener('click', () => setRating(root, button.getAttribute('data-stat-value')));
        button.addEventListener('keydown', (event) => {
          if (['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            setRating(root, button.getAttribute('data-stat-value'));
            return;
          }
          if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            return;
          }
          event.preventDefault();
          const current = Number(root.querySelector('[data-stat-rating-input]')?.value || 1);
          const next = event.key === 'Home'
            ? 1
            : event.key === 'End'
              ? 6
              : current + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 0.1 : -0.1);
          setRating(root, next);
          const focusValue = Math.max(1, Math.min(6, Math.round(next)));
          root.querySelector(`[data-stat-value="${focusValue}"]`)?.focus();
        });
      });
    });

    const closeStatInfoPanels = (except = null) => {
      document.querySelectorAll('[data-player-stat-info-panel]').forEach((panel) => {
        if (panel !== except) panel.remove();
      });
      document.querySelectorAll('[data-player-stat-info][aria-expanded="true"]').forEach((button) => {
        if (except && button.closest('.player-table-stat, .stat-form-row')?.contains(except)) return;
        button.setAttribute('aria-expanded', 'false');
      });
    };

    const toggleStatInfo = (statRow) => {
      const field = statRow.getAttribute('data-player-stat-info') || '';
      const label = statRow.getAttribute('data-player-stat-label') || statRow.querySelector('.player-stat-info-trigger')?.textContent.trim() || '';
      const description = statRow.getAttribute('data-player-stat-description') || '';
      if (!field || !description || !statRow) return;

      const currentPanel = statRow.querySelector('[data-player-stat-info-panel]');
      if (currentPanel) {
        currentPanel.remove();
        statRow.setAttribute('aria-expanded', 'false');
        return;
      }

      closeStatInfoPanels();
      const panel = document.createElement('div');
      panel.className = 'player-stat-info-panel';
      panel.setAttribute('data-player-stat-info-panel', field);
      const text = document.createElement('p');
      text.textContent = description;
      panel.append(text);
      statRow.append(panel);
      statRow.setAttribute('aria-expanded', 'true');
    };

    const shouldIgnoreStatInfoClick = (target) => Boolean(target.closest('[data-stat-value], [data-stat-rating-range], input, select, textarea, button, a'));

    const syncGoalkeeperStats = (scope) => {
      syncPositionSelectOptions(scope);
      const hasGoalkeeper = hasPrimaryGoalkeeper(scope);
      scope.querySelectorAll('[data-goalkeeper-stat-row]').forEach((row) => {
        row.hidden = !hasGoalkeeper;
        row.querySelectorAll('input, select, textarea').forEach((input) => {
          input.disabled = !hasGoalkeeper;
        });
      });
      scope.querySelectorAll('[data-attack-stat-row]').forEach((row) => {
        row.hidden = false;
      });
      scope.querySelectorAll('[data-stat-help="goalkeeper_skill"]').forEach((row) => {
        row.hidden = !hasGoalkeeper;
      });
      updateGeneralRating(scope);
    };

    const scopes = document.querySelectorAll('form.player-create-body, form.player-edit-panel, tr[data-player-edit-row], .mobile-player-profile-panel');
    scopes.forEach((scope) => {
      syncGoalkeeperStats(scope);
      scope.querySelectorAll('[data-stat-rating-input]').forEach((input) => {
        input.addEventListener('input', () => {
          updateGeneralRating(scope);
          renderPlayerInfoScout(scope);
        });
        input.addEventListener('change', () => {
          updateGeneralRating(scope);
          renderPlayerInfoScout(scope);
        });
      });
      scope.querySelectorAll('input[name="positions[]"], select[name="positions[]"]').forEach((input) => {
        input.addEventListener('change', () => {
          syncGoalkeeperStats(scope);
          renderPlayerInfoScout(scope);
        });
      });
      scope.querySelectorAll('[data-position-simulation-select]').forEach((input) => {
        input.addEventListener('change', () => updatePositionSimulation(scope));
      });
      scope.querySelectorAll('input[name="name"]').forEach((input) => {
        input.addEventListener('input', () => renderPlayerInfoScout(scope));
        input.addEventListener('change', () => renderPlayerInfoScout(scope));
      });
      updateGeneralRating(scope);
      renderPlayerInfoScout(scope);
    });

    document.querySelectorAll(compactRadarSelector).forEach((card) => {
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Ver radar ampliado');
      card.title = 'Ver radar ampliado';
      card.addEventListener('keydown', (event) => {
        if (!['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        openPlayerRadarPanel(card);
      });
    });

    document.querySelectorAll('[data-player-readonly-form]').forEach((form) => {
      form.addEventListener('submit', (event) => event.preventDefault());
    });

    document.addEventListener('click', (event) => {
      const scoutToggle = event.target.closest('[data-player-info-scout-toggle]');
      if (scoutToggle) {
        togglePlayerInfoScout(scoutToggle);
        return;
      }
      const statInfoPanel = event.target.closest('[data-player-stat-info]');
      if (statInfoPanel && !shouldIgnoreStatInfoClick(event.target)) {
        toggleStatInfo(statInfoPanel);
        return;
      }
      const radarTrigger = event.target.closest(compactRadarSelector);
      if (radarTrigger) {
        openPlayerRadarPanel(radarTrigger);
        return;
      }
      if (event.target.closest('[data-player-radar-close]') || event.target.matches('[data-player-radar-panel]')) {
        closePlayerRadarPanel();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closePlayerRadarPanel();
        closeStatInfoPanels();
      }
    });
  })();
};

window.goodfellasInitPlayers = goodfellasInitPlayers;
document.addEventListener('goodfellas:init-players', goodfellasInitPlayers);
goodfellasInitPlayers();
