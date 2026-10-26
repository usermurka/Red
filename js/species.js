// ============================================================
// СПРАВОЧНИК ВИДОВ
// Структура: Тип → Класс → Отряд → Вид
// Каждый вид: id, latin, name, status, order (может быть null)
// ============================================================

const SPECIES = {

  // ============================================================
  // ЖИВОТНЫЕ
  // ============================================================
  animals: {
    label: 'Животные',
    classes: [

      // --------------------------------------------------------
      // ТИП МОЛЛЮСКИ – MOLLUSCA
      // --------------------------------------------------------
      {
        label: 'Тип Моллюски – MOLLUSCA',
        orders: [
          {
            label: 'Класс Брюхоногие – GASTROPODA',
            orders: [
              {
                label: 'Отряд Прудовикообразные – Lymnaeiformes',
                species: [
                  { id: 'myxas_glutinosa',           latin: 'Myxas glutinosa',           name: 'Прудовик плащеносный',        status: 3 },
                  { id: 'choanomphalus_riparius',    latin: 'Choanomphalus riparius',    name: 'Катушка береговая',           status: 3 },
                  { id: 'choanomphalus_rossmaessleri', latin: 'Choanomphalus rossmaessleri', name: 'Катушка Россмесслера',   status: 3 }
                ]
              }
            ]
          }
        ]
      },

      // --------------------------------------------------------
      // ТИП ЧЛЕНИСТОНОГИЕ – ARTHROPODA
      // --------------------------------------------------------
      {
        label: 'Тип Членистоногие – ARTHROPODA',
        orders: [
          {
            label: 'Класс Ракообразные – CRUSTACEA',
            orders: [
              {
                label: 'Отряд Десятиногие раки – Decapoda',
                species: [
                  { id: 'astacus_astacus',       latin: 'Astacus astacus',       name: 'Рак речной широкопалый', status: 3 },
                  { id: 'astacus_leptodactylus', latin: 'Astacus leptodactylus', name: 'Рак речной узкопалый',   status: 5 }
                ]
              }
            ]
          },
          {
            label: 'Класс Насекомые – INSECTA',
            orders: [
              {
                label: 'Отряд Богомоловые – Mantodea',
                species: [
                  { id: 'iris_polystictica', latin: 'Iris polystictica', name: 'Богомол испещрённый', status: 2 }
                ]
              },
              {
                label: 'Отряд Прямокрылые – Orthoptera',
                species: [
                  { id: 'saga_pedo',      latin: 'Saga pedo',      name: 'Дыбка степная',        status: 1 },
                  { id: 'montana_striata', latin: 'Montana striata', name: 'Скачок морщинистый',   status: 4 }
                ]
              },
              {
                label: 'Отряд Жесткокрылые – Coleoptera',
                species: [
                  { id: 'calosoma_sycophanta',   latin: 'Calosoma sycophanta',   name: 'Красотел пахучий', status: 3 },
                  { id: 'purpuricenus_kaehleri', latin: 'Purpuricenus kaehleri', name: 'Усач Келера',      status: 3 }
                ]
              },
              {
                label: 'Отряд Чешуекрылые – Lepidoptera',
                species: [
                  { id: 'sibirarctia_kindermanni',   latin: 'Sibirarctia kindermanni',   name: 'Медведица Киндерманна',                  status: 1 },
                  { id: 'ahlbergia_frivaldszkyi',    latin: 'Ahlbergia frivaldszkyi',    name: 'Хвостатка (голубянка) Фривальдского',    status: 3 },
                  { id: 'zegris_eupheme',            latin: 'Zegris eupheme',            name: 'Зорька (белянка) Эвфема',                status: 4 },
                  { id: 'parnassius_apollo',         latin: 'Parnassius apollo',         name: 'Аполлон',                                 status: 3 },
                  { id: 'iphiclides_podalirius',     latin: 'Iphiclides podalirius',     name: 'Подалирий',                               status: 6 },
                  { id: 'eudia_pavonia',             latin: 'Eudia pavonia',             name: 'Павлиний глаз ночной малый',              status: 3 },
                  { id: 'apatura_iris',              latin: 'Apatura iris',              name: 'Переливница большая',                    status: 3 },
                  { id: 'apatura_metis',             latin: 'Apatura metis',             name: 'Переливница Метида',                     status: 3 },
                  { id: 'phymatopus_hecta',          latin: 'Phymatopus hecta',          name: 'Тонкопряд вересковый',                   status: 3 },
                  { id: 'paracossulus_thrips',       latin: 'Paracossulus thrips',       name: 'Древоточец точило полынный',             status: 3 },
                  { id: 'eversmannia_exornata',      latin: 'Eversmannia exornata',      name: 'Эпиплема (эверсманния) украшенная',      status: 3 },
                  { id: 'phigalia_djakonovi',        latin: 'Phigalia djakonovi',        name: 'Пяденица Дьяконова',                     status: 3 },
                  { id: 'proserpinus_proserpina',    latin: 'Proserpinus proserpina',    name: 'Прозерпина',                              status: 3 },
                  { id: 'hyles_hippophaes',          latin: 'Hyles hippophaes',          name: 'Бражник облепиховый',                    status: 3 },
                  { id: 'watsonarctia_deserta',      latin: 'Watsonarctia deserta',      name: 'Медведица пустынная',                    status: 3 },
                  { id: 'hemaris_tityus',            latin: 'Hemaris tityus',            name: 'Бражник Титий, шмелевидка скабиозовая',  status: 3 },
                  { id: 'acronicta_major',           latin: 'Acronicta major',           name: 'Стрельчатка большая',                    status: 3 },
                  { id: 'cucullia_magnifica',        latin: 'Cucullia magnifica',        name: 'Капюшонница великолепная',               status: 3 },
                  { id: 'ipimorpha_contusa',         latin: 'Ipimorpha contusa',         name: 'Совка лиственная серо-бурая',            status: 3 },
                  { id: 'chelis_maculosa',           latin: 'Chelis maculosa',           name: 'Медведица пятнистая',                    status: 3 },
                  { id: 'chelis_dahurica',           latin: 'Chelis dahurica',           name: 'Медведица даурская',                     status: 3 },
                  { id: 'epatolmis_caesarea',        latin: 'Epatolmis caesarea',        name: 'Медведица царская',                      status: 3 },
                  { id: 'syntomis_transcaspica',     latin: 'Syntomis transcaspica',     name: 'Лжепестрянка транскаспийская',           status: 3 },
                  { id: 'lycaena_helle',             latin: 'Lycaena helle',             name: 'Червонец голубоватый',                   status: 3 },
                  { id: 'cupido_osiris',             latin: 'Cupido osiris',             name: 'Голубянка Осирис',                       status: 3 },
                  { id: 'scolitantides_orion',       latin: 'Scolitantides orion',       name: 'Голубянка Орион',                        status: 3 },
                  { id: 'pseudophilotes_vicrama',    latin: 'Pseudophilotes vicrama',    name: 'Голубянка Викрама',                      status: 3 },
                  { id: 'plebejus_cyane',            latin: 'Plebejus cyane',            name: 'Голубянка синяя',                        status: 3 },
                  { id: 'plebejus_pylaon',           latin: 'Plebejus pylaon',           name: 'Голубянка поволжская',                   status: 3 },
                  { id: 'clossiana_angarensis',      latin: 'Clossiana angarensis',      name: 'Перламутровка ангарская',                status: 3 },
                  { id: 'clossiana_freja',           latin: 'Clossiana freja',           name: 'Перламутровка Фрейя',                    status: 3 },
                  { id: 'clossiana_thore',           latin: 'Clossiana thore',           name: 'Перламутровка таежная',                  status: 3 },
                  { id: 'boloria_aquilonaris',       latin: 'Boloria aquilonaris',       name: 'Перламутровка болотная',                 status: 3 },
                  { id: 'argyronome_laodice',        latin: 'Argyronome laodice',        name: 'Перламутровка зеленоватая',              status: 3 },
                  { id: 'oeneis_jutta',              latin: 'Oeneis jutta',              name: 'Энеис болотная',                         status: 3 },
                  { id: 'coenonympha_amaryllis',     latin: 'Coenonympha amaryllis',     name: 'Сенница Амариллис',                      status: 3 }
                ]
              },
              {
                label: 'Отряд Перепончатокрылые – Hymenoptera',
                species: [
                  { id: 'onychopterocheilus_pallasii', latin: 'Onychopterocheilus pallasii', name: 'Оса Палласа',                status: 3 },
                  { id: 'bombus_armeniacus',           latin: 'Bombus armeniacus',           name: 'Шмель армянский',            status: 3 },
                  { id: 'bombus_sichelii',             latin: 'Bombus sichelii',             name: 'Шмель Зихеля',               status: 3 },
                  { id: 'bombus_ruderarius',           latin: 'Bombus ruderarius',           name: 'Шмель малый каменный',       status: 3 },
                  { id: 'bombus_muscorum',             latin: 'Bombus muscorum',             name: 'Шмель моховой',              status: 3 },
                  { id: 'bombus_confusus',             latin: 'Bombus confusus',             name: 'Шмель необыкновенный',       status: 3 },
                  { id: 'bombus_patagiatus',           latin: 'Bombus patagiatus',           name: 'Шмель окаймлённый',          status: 2 },
                  { id: 'bombus_maculidorsis',         latin: 'Bombus maculidorsis',         name: 'Шмель пятнистоспинный',      status: 3 },
                  { id: 'bombus_consobrinus',          latin: 'Bombus consobrinus',          name: 'Шмель родственный',          status: 2 },
                  { id: 'bombus_semenoviellus',        latin: 'Bombus semenoviellus',        name: 'Шмель семёновский',          status: 3 },
                  { id: 'bombus_modestus',             latin: 'Bombus modestus',             name: 'Шмель скромный',             status: 3 },
                  { id: 'bombus_fragrans',             latin: 'Bombus fragrans',             name: 'Шмель степной',              status: 2 },
                  { id: 'psithyrus_sylvestris',        latin: 'Psithyrus sylvestris',        name: 'Шмель-кукушка лесной',       status: 3 },
                  { id: 'andrena_comta',               latin: 'Andrena comta',               name: 'Андрена аккуратная',         status: 2 },
                  { id: 'andrena_flavipes',            latin: 'Andrena flavipes',            name: 'Андрена желтоногая',         status: 4 },
                  { id: 'andrena_chrysosceles',        latin: 'Andrena chrysosceles',        name: 'Андрена золотистая',         status: 3 },
                  { id: 'andrena_carbonaria',          latin: 'Andrena carbonaria',          name: 'Андрена угольная',           status: 3 },
                  { id: 'andrena_gallica',             latin: 'Andrena gallica',             name: 'Андрена французская',        status: 3 },
                  { id: 'andrena_wilkella',            latin: 'Andrena wilkella',            name: 'Андрена Уилка',              status: 3 },
                  { id: 'andrena_atrata',              latin: 'Andrena atrata',              name: 'Андрена черноватая',         status: 2 },
                  { id: 'andrena_rosae',               latin: 'Andrena rosae',               name: 'Андрена шиповниковая',       status: 3 },
                  { id: 'andrena_labialis',            latin: 'Andrena labialis',            name: 'Андрена широкогубая',        status: 3 },
                  { id: 'melitturga_clavicornis',      latin: 'Melitturga clavicornis',      name: 'Мелиттурга булавоусая',      status: 2 }
                ]
              },
              {
                label: 'Отряд Двукрылые – Diptera',
                species: [
                  { id: 'satanas_gigas', latin: 'Satanas gigas', name: 'Ктырь гигантский', status: 2 }
                ]
              }
            ]
          }
        ]
      },

      // --------------------------------------------------------
      // ТИП ХОРДОВЫЕ – CHORDATA
      // --------------------------------------------------------
      {
        label: 'Тип Хордовые – CHORDATA',
        orders: [
          {
            label: 'Класс Круглоротые – CYCLOSTOMATA',
            orders: [
              {
                label: 'Отряд Мингообразные – Petromyzoniformes',
                species: [
                  { id: 'lethenteron_japonicum', latin: 'Lethenteron japonicum', name: 'Минога японская (тихоокеанская)', status: 4 },
                  { id: 'lethenteron_kessleri',  latin: 'Lethenteron kessleri',  name: 'Минога сибирская',                status: 4 }
                ]
              }
            ]
          },
          {
            label: 'Класс Костные рыбы – OSTEICHTHYES',
            orders: [
              {
                label: 'Отряд Осетрообразные – Acipenseriformes',
                species: [
                  { id: 'acipenser_baerii',   latin: 'Acipenser baerii',   name: 'Осётр сибирский',      status: 2 }
                ]
              },
              {
                label: 'Отряд Лососеобразные – Salmoniformes',
                species: [
                  { id: 'stenodus_leucichthys', latin: 'Stenodus leucichthys', name: 'Нельма',               status: 2 }
                ]
              },
              {
                label: 'Отряд Карпообразные – Cypriniformes',
                species: [
                  { id: 'cobitis_melanoleuca', latin: 'Cobitis melanoleuca', name: 'Щиповка сибирская',    status: 4 }
                ]
              },
              {
                label: 'Отряд Скорпенообразные – Scorpaeniformes',
                species: [
                  { id: 'cottus_sibiricus',   latin: 'Cottus sibiricus',   name: 'Подкаменщик сибирский', status: 4 }
                ]
              }
            ]
          },
          {
            label: 'Класс Земноводные – AMPHIBIA',
            orders: [
              {
                label: 'Отряд Хвостатые – Caudata',
                species: [
                  { id: 'hynobius_keyserlingi', latin: 'Hynobius keyserlingi', name: 'Углозуб сибирский',     status: 3 },
                  { id: 'triturus_vulgaris',    latin: 'Triturus vulgaris',    name: 'Тритон обыкновенный',   status: 3 }
                ]
              },
              {
                label: 'Отряд Бесхвостые – Anura',
                species: [
                  { id: 'bufo_bufo',            latin: 'Bufo bufo',            name: 'Жаба серая',            status: 3 }
                ]
              }
            ]
          },
          {
            label: 'Класс Пресмыкающиеся – REPTILIA',
            orders: [
              {
                label: 'Отряд Чешуйчатые – Squamata',
                species: [
                  { id: 'vipera_berus',  latin: 'Vipera berus',  name: 'Гадюка обыкновенная',  status: 3 },
                  { id: 'natrix_natrix', latin: 'Natrix natrix', name: 'Уж обыкновенный',       status: 3 }
                ]
              }
            ]
          },
          {
            label: 'Класс Птицы – AVES',
            orders: [
              {
                label: 'Отряд Гагарообразные – Gaviformes',
                species: [
                  { id: 'gavia_arctica',           latin: 'Gavia arctica',           name: 'Гагара чернозобая',                    status: 3 }
                ]
              },
              {
                label: 'Отряд Поганкообразные – Podicipediformes',
                species: [
                  { id: 'podiceps_ruficollis',     latin: 'Podiceps ruficollis',     name: 'Поганка малая',                        status: 3 },
                  { id: 'podiceps_griseigena',     latin: 'Podiceps griseigena',     name: 'Поганка серощёкая',                    status: 3 }
                ]
              },
              {
                label: 'Отряд Веслоногие – Pelecaniformes',
                species: [
                  { id: 'pelecanus_crispus',       latin: 'Pelecanus crispus',       name: 'Пеликан кудрявый',                     status: 3 },
                  { id: 'pelecanus_onocrotalus',   latin: 'Pelecanus onocrotalus',   name: 'Пеликан розовый',                      status: 6 }
                ]
              },
              {
                label: 'Отряд Аистообразные – Ciconiiformes',
                species: [
                  { id: 'ixobrychus_minutus',      latin: 'Ixobrychus minutus',      name: 'Выпь малая (волчок)',                  status: 3 },
                  { id: 'egretta_alba',            latin: 'Egretta alba',            name: 'Цапля белая большая',                  status: 3 },
                  { id: 'ciconia_nigra',           latin: 'Ciconia nigra',           name: 'Аист чёрный',                          status: 6 }
                ]
              },
              {
                label: 'Отряд Фламингообразные – Phoenicopteriformes',
                species: [
                  { id: 'phoenicopterus_roseus',   latin: 'Phoenicopterus roseus',   name: 'Фламинго обыкновенный',                status: 6 }
                ]
              },
              {
                label: 'Отряд Гусеобразные – Anseriformes',
                species: [
                  { id: 'branta_bernicla',         latin: 'Branta bernicla',         name: 'Казарка чёрная',                       status: 6 },
                  { id: 'rufibrenta_ruficollis',   latin: 'Rufibrenta ruficollis',   name: 'Казарка краснозобая',                  status: 6 },
                  { id: 'anser_erythropus',        latin: 'Anser erythropus',        name: 'Пискулька',                            status: 6 },
                  { id: 'cygnus_olor',             latin: 'Cygnus olor',             name: 'Лебедь-шипун',                         status: 3 },
                  { id: 'cygnus_cygnus',           latin: 'Cygnus cygnus',           name: 'Лебедь-кликун',                        status: 3 },
                  { id: 'cygnus_bewickii',         latin: 'Cygnus bewickii',         name: 'Лебедь малый (тундряной)',             status: 6 },
                  { id: 'tadorna_ferruginea',      latin: 'Tadorna ferruginea',      name: 'Огарь',                                status: 3 },
                  { id: 'tadorna_tadorna',         latin: 'Tadorna tadorna',         name: 'Пеганка',                              status: 3 },
                  { id: 'aythya_nyroca',           latin: 'Aythya nyroca',           name: 'Нырок белоглазый',                     status: 3 },
                  { id: 'netta_rufina',            latin: 'Netta rufina',            name: 'Нырок красноносый',                    status: 3 },
                  { id: 'oxyura_leucocephala',     latin: 'Oxyura leucocephala',     name: 'Савка',                                status: 3 }
                ]
              },
              {
                label: 'Отряд Соколообразные – Falconiformes',
                species: [
                  { id: 'pandion_haliaetus',       latin: 'Pandion haliaetus',       name: 'Скопа',                                status: 3 },
                  { id: 'pernis_apivorus',         latin: 'Pernis apivorus',         name: 'Осоед обыкновенный',                   status: 4 },
                  { id: 'circus_macrourus',        latin: 'Circus macrourus',        name: 'Лунь степной',                         status: 3 },
                  { id: 'buteo_rufinus',           latin: 'Buteo rufinus',           name: 'Канюк-курганник',                      status: 6 },
                  { id: 'aquila_nipalensis',       latin: 'Aquila nipalensis',       name: 'Орёл степной',                         status: 3 },
                  { id: 'aquila_clanga',           latin: 'Aquila clanga',           name: 'Подорлик большой',                     status: 3 },
                  { id: 'aquila_heliaca',          latin: 'Aquila heliaca',          name: 'Орёл-могильник',                       status: 4 },
                  { id: 'aquila_chrysaetos',       latin: 'Aquila chrysaetos',       name: 'Беркут',                               status: 3 },
                  { id: 'haliaeetus_albicilla',    latin: 'Haliaeetus albicilla',    name: 'Орлан-белохвост',                      status: 3 },
                  { id: 'aegypius_monachus',       latin: 'Aegypius monachus',       name: 'Гриф чёрный (бурый)',                  status: 6 },
                  { id: 'falco_rusticolus',        latin: 'Falco rusticolus',        name: 'Кречет сибирский',                     status: 6 },
                  { id: 'falco_cherrug',           latin: 'Falco cherrug',           name: 'Балобан обыкновенный',                 status: 3 },
                  { id: 'falco_peregrinus',        latin: 'Falco peregrinus',        name: 'Сапсан',                               status: 3 },
                  { id: 'falco_columbarius',       latin: 'Falco columbarius',       name: 'Дербник',                              status: 3 },
                  { id: 'falco_subbuteo',          latin: 'Falco subbuteo',          name: 'Чеглок',                               status: 3 },
                  { id: 'falco_vespertinus',       latin: 'Falco vespertinus',       name: 'Кобчик',                               status: 3 },
                  { id: 'falco_naumanni',          latin: 'Falco naumanni',          name: 'Пустельга степная',                    status: 1 }
                ]
              },
              {
                label: 'Отряд Курообразные – Galliformes',
                species: [
                  { id: 'perdix_perdix',           latin: 'Perdix perdix',           name: 'Куропатка серая',                      status: 7 }
                ]
              },
              {
                label: 'Отряд Журавлеобразные – Gruiformes',
                species: [
                  { id: 'grus_leucogeranus',       latin: 'Grus leucogeranus',       name: 'Журавль белый (стерх)',                status: 6 },
                  { id: 'grus_monacha',            latin: 'Grus monacha',            name: 'Журавль чёрный',                       status: 6 },
                  { id: 'grus_grus',               latin: 'Grus grus',               name: 'Журавль серый',                        status: 3 },
                  { id: 'anthropoides_virgo',      latin: 'Anthropoides virgo',      name: 'Журавль-красавка',                     status: 5 },
                  { id: 'crex_crex',               latin: 'Crex crex',               name: 'Коростель',                            status: 5 },
                  { id: 'gallinula_chloropus',     latin: 'Gallinula chloropus',     name: 'Камышница',                            status: 3 },
                  { id: 'otis_tarda',              latin: 'Otis tarda',              name: 'Дрофа',                                status: 4 },
                  { id: 'tetrax_tetrax',           latin: 'Tetrax tetrax',           name: 'Стрепет',                              status: 5 },
                  { id: 'chlamydotis_undulata',    latin: 'Chlamydotis undulata',    name: 'Дрофа-красотка (джек)',                status: 6 }
                ]
              },
              {
                label: 'Отряд Ржанкообразные – Charadriiformes',
                species: [
                  { id: 'burhinus_oedicnemus',     latin: 'Burhinus oedicnemus',     name: 'Авдотка азиатская',                    status: 6 },
                  { id: 'chettusia_gregaria',      latin: 'Chettusia gregaria',      name: 'Кречетка',                             status: 3 },
                  { id: 'recurvirostra_avosetta',  latin: 'Recurvirostra avosetta',  name: 'Шилоклювка',                           status: 3 },
                  { id: 'himantopus_himantopus',   latin: 'Himantopus himantopus',   name: 'Ходулочник',                           status: 3 },
                  { id: 'haematopus_ostralegus',   latin: 'Haematopus ostralegus',   name: 'Кулик-сорока',                         status: 3 },
                  { id: 'tringa_nebularia',        latin: 'Tringa nebularia',        name: 'Улит большой',                         status: 3 },
                  { id: 'gallinago_megala',        latin: 'Gallinago megala',        name: 'Дупель лесной',                        status: 3 },
                  { id: 'numenius_tenuirostris',   latin: 'Numenius tenuirostris',   name: 'Кроншнеп тонкоклювый',                 status: 0 },
                  { id: 'numenius_arquata',        latin: 'Numenius arquata',        name: 'Кроншнеп большой',                     status: 3 },
                  { id: 'numenius_phaeopus',       latin: 'Numenius phaeopus',       name: 'Кроншнеп средний',                     status: 6 },
                  { id: 'limosa_limosa',           latin: 'Limosa limosa',           name: 'Веретенник большой',                   status: 3 },
                  { id: 'limnodromus_semipalmatus', latin: 'Limnodromus semipalmatus', name: 'Веретенник бекасовидный азиатский',  status: 1 },
                  { id: 'glareola_nordmanni',      latin: 'Glareola nordmanni',      name: 'Тиркушка степная',                     status: 3 },
                  { id: 'larus_ichthyaetus',       latin: 'Larus ichthyaetus',       name: 'Хохотун черноголовый',                 status: 3 },
                  { id: 'hydroprogne_caspia',      latin: 'Hydroprogne caspia',      name: 'Чеграва обыкновенная',                 status: 3 },
                  { id: 'sterna_albifrons',        latin: 'Sterna albifrons',        name: 'Крачка малая',                         status: 3 }
                ]
              },
              {
                label: 'Отряд Совообразные – Strigiformes',
                species: [
                  { id: 'nyctea_scandiaca',        latin: 'Nyctea scandiaca',        name: 'Сова белая (полярная)',                status: 7 },
                  { id: 'bubo_bubo',               latin: 'Bubo bubo',               name: 'Филин',                                status: 3 },
                  { id: 'otus_scops',              latin: 'Otus scops',              name: 'Сплюшка',                              status: 3 },
                  { id: 'athene_noctua',           latin: 'Athene noctua',           name: 'Сыч домовый',                          status: 3 },
                  { id: 'aegolius_funereus',       latin: 'Aegolius funereus',       name: 'Сыч мохноногий',                       status: 3 },
                  { id: 'glaucidium_passerinum',   latin: 'Glaucidium passerinum',   name: 'Сыч воробьиный',                       status: 3 },
                  { id: 'surnia_ulula',            latin: 'Surnia ulula',            name: 'Сова ястребиная',                      status: 3 },
                  { id: 'strix_nebulosa',          latin: 'Strix nebulosa',          name: 'Неясыть бородатая',                    status: 3 }
                ]
              },
              {
                label: 'Отряд Ракшеобразные – Coraciiformes',
                species: [
                  { id: 'coracias_garrulus',       latin: 'Coracias garrulus',       name: 'Сизоворонка европейская (ракша)',      status: 3 },
                  { id: 'alcedo_atthis',           latin: 'Alcedo atthis',           name: 'Зимородок обыкновенный',               status: 3 },
                  { id: 'merops_apiaster',         latin: 'Merops apiaster',         name: 'Щурка золотистая',                     status: 3 },
                  { id: 'upupa_epops',             latin: 'Upupa epops',             name: 'Удод обыкновенный',                    status: 3 }
                ]
              },
              {
                label: 'Отряд Дятлообразные – Piciformes',
                species: [
                  { id: 'dryocopus_martius',       latin: 'Dryocopus martius',       name: 'Дятел чёрный (желна)',                 status: 7 }
                ]
              },
              {
                label: 'Отряд Воробьинообразные – Passeriformes',
                species: [
                  { id: 'melanocorypha_leucoptera', latin: 'Melanocorypha leucoptera', name: 'Жаворонок белокрылый',              status: 6 },
                  { id: 'melanocorypha_yeltoniensis', latin: 'Melanocorypha yeltoniensis', name: 'Жаворонок чёрный',               status: 3 },
                  { id: 'eremophila_alpestris',    latin: 'Eremophila alpestris',    name: 'Жаворонок рогатый',                    status: 6 },
                  { id: 'anthus_campestris',       latin: 'Anthus campestris',       name: 'Конёк полевой',                        status: 3 },
                  { id: 'anthus_richardi',         latin: 'Anthus richardi',         name: 'Конёк степной сибирский',              status: 3 },
                  { id: 'anthus_hodgsoni',         latin: 'Anthus hodgsoni',         name: 'Конёк пятнистый (зелёный)',            status: 3 },
                  { id: 'lanius_excubitor',        latin: 'Lanius excubitor',        name: 'Сорокопут серый (большой)',            status: 3 },
                  { id: 'lanius_minor',            latin: 'Lanius minor',            name: 'Сорокопут чернолобый',                 status: 3 },
                  { id: 'locustella_certhiola',    latin: 'Locustella certhiola',    name: 'Сверчок певчий',                       status: 3 },
                  { id: 'acrocephalus_paludicola', latin: 'Acrocephalus paludicola', name: 'Камышовка вертлявая',                  status: 3 },
                  { id: 'sylvia_atricapilla',      latin: 'Sylvia atricapilla',      name: 'Славка черноголовая',                  status: 3 },
                  { id: 'regulus_regulus',         latin: 'Regulus regulus',         name: 'Королёк желтоголовый',                 status: 3 },
                  { id: 'luscinia_luscinia',       latin: 'Luscinia luscinia',       name: 'Соловей обыкновенный (восточный)',     status: 7 },
                  { id: 'zoothera_dauma',          latin: 'Zoothera dauma',          name: 'Дрозд пёстрый (земляной)',             status: 4 },
                  { id: 'tarsiger_cyanurus',       latin: 'Tarsiger cyanurus',       name: 'Синехвостка',                          status: 3 },
                  { id: 'panurus_biarmicus',       latin: 'Panurus biarmicus',       name: 'Синица усатая',                        status: 3 },
                  { id: 'uragus_sibiricus',        latin: 'Uragus sibiricus',        name: 'Чечевица длиннохвостая (урагус)',      status: 3 },
                  { id: 'loxia_curvirostra',       latin: 'Loxia curvirostra',       name: 'Клёст обыкновенный (еловик)',          status: 3 },
                  { id: 'pinicola_enucleator',     latin: 'Pinicola enucleator',     name: 'Щур',                                  status: 6 }
                ]
              }
            ]
          },
          {
            label: 'Класс Млекопитающие – MAMMALIA',
            orders: [
              {
                label: 'Отряд Насекомоядные – Insectivora',
                species: [
                  { id: 'hemiechinus_auritus',   latin: 'Hemiechinus auritus',   name: 'Ёж ушастый',                 status: 3 },
                  { id: 'sorex_minutissimus',    latin: 'Sorex minutissimus',    name: 'Бурозубка крошечная',        status: 3 },
                  { id: 'neomys_fodiens',        latin: 'Neomys fodiens',        name: 'Кутора обыкновенная',        status: 3 }
                ]
              },
              {
                label: 'Отряд Рукокрылые – Chiroptera',
                species: [
                  { id: 'eptesicus_nilssoni',    latin: 'Eptesicus nilssoni',    name: 'Кожанок северный',           status: 2 },
                  { id: 'vespertilio_murinus',   latin: 'Vespertilio murinus',   name: 'Кожан двухцветный',          status: 3 }
                ]
              },
              {
                label: 'Отряд Грызуны – Rodentia',
                species: [
                  { id: 'pteromys_volans',       latin: 'Pteromys volans',       name: 'Летяга обыкновенная',        status: 3 },
                  { id: 'marmota_bobak',         latin: 'Marmota bobak',         name: 'Сурок степной (байбак)',     status: 1 },
                  { id: 'sicista_subtilis',      latin: 'Sicista subtilis',      name: 'Мышовка степная',            status: 3 },
                  { id: 'sicista_betulina',      latin: 'Sicista betulina',      name: 'Мышовка лесная',             status: 3 },
                  { id: 'allactaga_major',       latin: 'Allactaga major',       name: 'Тушканчик большой',          status: 3 },
                  { id: 'cricetulus_migratorius', latin: 'Cricetulus migratorius', name: 'Хомячок серый',           status: 1 },
                  { id: 'cricetulus_barabensis', latin: 'Cricetulus barabensis', name: 'Хомячок барабинский',        status: 3 },
                  { id: 'allocricetulus_eversmanni', latin: 'Allocricetulus eversmanni', name: 'Хомячок Эверсманна', status: 3 },
                  { id: 'phodopus_sungorus',     latin: 'Phodopus sungorus',     name: 'Хомячок джунгарский',        status: 5 },
                  { id: 'lagurus_lagurus',       latin: 'Lagurus lagurus',       name: 'Пеструшка степная',          status: 3 }
                ]
              },
              {
                label: 'Отряд Хищные – Carnivora',
                species: [
                  { id: 'gulo_gulo',             latin: 'Gulo gulo',             name: 'Росомаха',                   status: 3 },
                  { id: 'mustela_lutreola',      latin: 'Mustela lutreola',      name: 'Норка европейская',          status: 0 },
                  { id: 'lutra_lutra',           latin: 'Lutra lutra',           name: 'Выдра',                      status: 1 },
                  { id: 'felis_lynx',            latin: 'Felis lynx',            name: 'Рысь',                       status: 3 }
                ]
              },
              {
                label: 'Отряд Парнокопытные – Artiodactyla',
                species: [
                  { id: 'rangifer_tarandus',     latin: 'Rangifer tarandus',     name: 'Олень северный',             status: 3 },
                  { id: 'saiga_tatarica',        latin: 'Saiga tatarica',        name: 'Сайгак',                     status: 0 }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  // ============================================================
  // РАСТЕНИЯ
  // ============================================================
  plants: {
    label: 'Растения',
    classes: [
      {
        label: 'Сосудистые растения',
        orders: [
          {
            label: 'Отдел Магнолиевые (Цветковые, Покрытосеменные) – MAGNOLIOPHYTA (ANGIOSPERMAE)',
            orders: [
              {
                label: 'Класс Магнолиопсиды (Двудольные) – MAGNOLIOPSIDA (DICOTYLEDONES)',
                orders: [
                  {
                    label: 'Семейство Нимфейные (Кувшинковые) – Nymphaeaceae Salisb.',
                    species: [
                      { id: 'nuphar_lutea',              latin: 'Nuphar lutea',              name: 'Кубышка жёлтая',                       status: 3 },
                      { id: 'nuphar_pumila',             latin: 'Nuphar pumila',             name: 'Кубышка малая',                        status: 2 },
                      { id: 'nymphaea_tetragona',        latin: 'Nymphaea tetragona',        name: 'Кувшинка четырёхугольная',             status: 2 },
                      { id: 'nymphaea_candida',          latin: 'Nymphaea candida',          name: 'Кувшинка чистобелая',                  status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Лютиковые – Ranunculaceae Juss.',
                    species: [
                      { id: 'adonis_wolgensis',          latin: 'Adonis wolgensis',          name: 'Адонис волжский',                      status: 3 },
                      { id: 'adonis_villosa',            latin: 'Adonis villosa',            name: 'Адонис пушистый',                      status: 3 },
                      { id: 'actaea_spicata',            latin: 'Actaea spicata',            name: 'Воронец колосистый',                   status: 1 },
                      { id: 'actaea_erythrocarpa',       latin: 'Actaea erythrocarpa',       name: 'Воронец красноплодный',                status: 3 },
                      { id: 'trollius_asiaticus',        latin: 'Trollius asiaticus',        name: 'Купальница азиатская',                 status: 4 },
                      { id: 'trollius_europaeus',        latin: 'Trollius europaeus',        name: 'Купальница европейская',               status: 2 },
                      { id: 'delphinium_laxiflorum',     latin: 'Delphinium laxiflorum',     name: 'Живокость редкоцветная',               status: 1 },
                      { id: 'delphinium_dictyocarpum',   latin: 'Delphinium dictyocarpum',   name: 'Живокость сетчатоплодная',             status: 2 },
                      { id: 'ranunculus_silvisteppaceus', latin: 'Ranunculus silvisteppaceus', name: 'Лютик лесостепной',                 status: 2 },
                      { id: 'ranunculus_polyphyllus',    latin: 'Ranunculus polyphyllus',    name: 'Лютик многолистный',                   status: 3 },
                      { id: 'ranunculus_reptans',        latin: 'Ranunculus reptans',        name: 'Лютик стелющийся',                     status: 3 },
                      { id: 'ranunculus_radicans',       latin: 'Ranunculus radicans',       name: 'Лютик укореняющийся',                  status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Пионовые – Paeoniaceae Raf.',
                    species: [
                      { id: 'paeonia_anomala',           latin: 'Paeonia anomala',           name: 'Пион уклоняющийся (марьин корень)',    status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Берёзовые – Betulaceae S. F. Gray',
                    species: [
                      { id: 'alnus_incana',              latin: 'Alnus incana',              name: 'Ольха серая',                          status: 1 }
                    ]
                  },
                  {
                    label: 'Семейство Гвоздичные – Caryophyllaceae Juss.',
                    species: [
                      { id: 'dianthus_acicularis',       latin: 'Dianthus acicularis',       name: 'Гвоздика игольчатая',                  status: 2 },
                      { id: 'dianthus_ramosissimus',     latin: 'Dianthus ramosissimus',     name: 'Гвоздика сильноветвистая',             status: 1 },
                      { id: 'dianthus_leptopetalus',     latin: 'Dianthus leptopetalus',     name: 'Гвоздика узколепестная',               status: 1 }
                    ]
                  },
                  {
                    label: 'Семейство Маревые – Chenopodiaceae Vent.',
                    species: [
                      { id: 'krascheninnikovia_ceratoides', latin: 'Krascheninnikovia ceratoides', name: 'Крашенинниковия терескеновая',    status: 1 },
                      { id: 'ofaiston_monandrum',        latin: 'Ofaiston monandrum',        name: 'Офайстон однотычинковый',              status: 2 },
                      { id: 'kalidium_foliatum',         latin: 'Kalidium foliatum',         name: 'Поташник олиственный',                 status: 2 },
                      { id: 'halocnemum_strobilaceum',   latin: 'Halocnemum strobilaceum',   name: 'Сарсазан шишковатый',                  status: 2 }
                    ]
                  },
                  {
                    label: 'Семейство Гречишные – Polygonaceae Juss.',
                    species: [
                      { id: 'atraphaxis_frutescens',     latin: 'Atraphaxis frutescens',     name: 'Курчавка кустарниковая',               status: 2 }
                    ]
                  },
                  {
                    label: 'Семейство Зверобойные – Hypericaceae Juss.',
                    species: [
                      { id: 'hypericum_ascyron',         latin: 'Hypericum ascyron',         name: 'Зверобой большой',                     status: 2 },
                      { id: 'hypericum_elegans',         latin: 'Hypericum elegans',         name: 'Зверобой изящный',                     status: 2 }
                    ]
                  },
                  {
                    label: 'Семейство Повойничковые – Elatinaceae Dumort.',
                    species: [
                      { id: 'elatine_hydropiper',        latin: 'Elatine hydropiper',        name: 'Повойничек водноперечный',             status: 2 }
                    ]
                  },
                  {
                    label: 'Семейство Вересковые – Ericaceae Juss.',
                    species: [
                      { id: 'calluna_vulgaris',          latin: 'Calluna vulgaris',          name: 'Вереск обыкновенный',                  status: 0 }
                    ]
                  },
                  {
                    label: 'Семейство Первоцветные – Primulaceae Batsch ex Borkh.',
                    species: [
                      { id: 'primula_longiscapa',        latin: 'Primula longiscapa',        name: 'Первоцвет длиннострелочный',           status: 3 },
                      { id: 'primula_farinosa',          latin: 'Primula farinosa',          name: 'Первоцвет мучнистый',                  status: 4 }
                    ]
                  },
                  {
                    label: 'Семейство Франкениевые – Frankeniaceae S. F. Gray',
                    species: [
                      { id: 'frankenia_hirsuta',        latin: 'Frankenia hirsuta L.',        name: 'Франкения жестковолосистая',           status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Капустные (Крестоцветные) – Brassicaceae Burnett (Cruciferae Juss.)',
                    species: [
                      { id: 'alyssum_lenense',           latin: 'Alyssum lenense',           name: 'Бурачок ленский',                      status: 2 },
                      { id: 'alyssum_obovatum',          latin: 'Alyssum obovatum',          name: 'Бурачок обратнояйцевидный',            status: 1 },
                      { id: 'clausia_aprica',            latin: 'Clausia aprica',            name: 'Клаусия солнцепечная',                 status: 1 }
                    ]
                  },
                  {
                    label: 'Семейство Липовые – Tiliaceae Juss.',
                    species: [
                      { id: 'tilia_cordata',             latin: 'Tilia cordata',             name: 'Липа сердцевидная',                    status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Мальвовые – Malvaceae Juss.',
                    species: [
                      { id: 'althaea_officinalis',       latin: 'Althaea officinalis',       name: 'Алтей лекарственный',                  status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Толстянковые – Crassulaceae J. St.-Hil.',
                    species: [
                      { id: 'orostachys_spinosa',        latin: 'Orostachys spinosa',        name: 'Горноколосник колючий',                status: 2 }
                    ]
                  },
                  {
                    label: 'Семейство Розоцветные – Rosaceae Juss.',
                    species: [
                      { id: 'cerasus_fruticosa',         latin: 'Cerasus fruticosa',         name: 'Вишня кустарниковая',                  status: 1 },
                      { id: 'potentilla_erecta',         latin: 'Potentilla erecta',         name: 'Лапчатка прямостоящая',                status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Бобовые (Мотыльковые) – Fabaceae Lindl. (Leguminosae Juss.)',
                    species: [
                      { id: 'astragalus_altaicus',       latin: 'Astragalus altaicus',       name: 'Астрагал алтайский',                   status: 0 },
                      { id: 'astragalus_buchtormensis',  latin: 'Astragalus buchtormensis',  name: 'Астрагал бухтарминский',               status: 3 },
                      { id: 'astragalus_macropus',       latin: 'Astragalus macropus',       name: 'Астрагал длинноножковый',              status: 2 },
                      { id: 'astragalus_cornutus',       latin: 'Astragalus cornutus',       name: 'Астрагал рогоплодный',                 status: 1 },
                      { id: 'astragalus_consanguineus',  latin: 'Astragalus consanguineus',  name: 'Астрагал родственный',                 status: 1 },
                      { id: 'astragalus_contortuplicatus', latin: 'Astragalus contortuplicatus', name: 'Астрагал свернутый',              status: 2 },
                      { id: 'astragalus_tenuifolius',    latin: 'Astragalus tenuifolius',    name: 'Астрагал тонколистный',                status: 2 },
                      { id: 'astragalus_stenoceras',     latin: 'Astragalus stenoceras',     name: 'Астрагал узкорогий',                   status: 1 },
                      { id: 'hedysarum_gmelinii',        latin: 'Hedysarum gmelinii',        name: 'Копеечник Гмелина',                    status: 2 },
                      { id: 'lotus_sergievskiae',        latin: 'Lotus sergievskiae',        name: 'Лядвенец Сергиевской',                 status: 3 },
                      { id: 'lotus_ucrainicus',          latin: 'Lotus ucrainicus',          name: 'Лядвенец украинский',                  status: 0 },
                      { id: 'oxytropis_campanulata',     latin: 'Oxytropis campanulata',     name: 'Остролодочник колокольчатый',          status: 2 },
                      { id: 'lathyrus_gmelinii',         latin: 'Lathyrus gmelinii',         name: 'Чина Гмелина',                         status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Истодовые – Polygalaceae Hoffmanns. et Link',
                    species: [
                      { id: 'polygala_sibirica',         latin: 'Polygala sibirica',         name: 'Истод сибирский',                      status: 1 }
                    ]
                  },
                  {
                    label: 'Семейство Селитрянковые – Nitrariaceae Bercht. et J. Presl',
                    species: [
                      { id: 'nitraria_schoberi',         latin: 'Nitraria schoberi',         name: 'Селитрянка Шобера',                    status: 1 }
                    ]
                  },
                  {
                    label: 'Семейство Льновые – Linaceae DC. ex Perleb',
                    species: [
                      { id: 'linum_perenne',             latin: 'Linum perenne',             name: 'Лён многолетний',                      status: 2 }
                    ]
                  },
                  {
                    label: 'Семейство Сельдерейные (Зонтичные) – Apiaceae Lindl. (Umbelliferae Juss.)',
                    species: [
                      { id: 'bupleurum_bicaule',         latin: 'Bupleurum bicaule',         name: 'Володушка двухпобеговая',              status: 1 }
                    ]
                  },
                  {
                    label: 'Семейство Валериановые – Valerianaceae Batsch',
                    species: [
                      { id: 'valeriana_tuberosa',        latin: 'Valeriana tuberosa',        name: 'Валериана клубненосная',               status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Колокольчиковые – Campanulaceae Juss.',
                    species: [
                      { id: 'campanula_bononiensis',     latin: 'Campanula bononiensis',     name: 'Колокольчик болонский',                status: 2 },
                      { id: 'campanula_glomerata',       latin: 'Campanula glomerata',       name: 'Колокольчик скученный',                status: 2 }
                    ]
                  },
                  {
                    label: 'Семейство Астровые (Сложноцветные) – Asteraceae Bercht. et J. Presl (Compositae Giseke)',
                    species: [
                      { id: 'aster_alpinus',             latin: 'Aster alpinus',             name: 'Астра альпийская',                     status: 3 },
                      { id: 'rhaponticum_serratuloides', latin: 'Rhaponticum serratuloides', name: 'Большеголовник серпуховый',            status: 2 },
                      { id: 'centaurea_sibirica',        latin: 'Centaurea sibirica',        name: 'Василёк сибирский',                    status: 2 },
                      { id: 'scorzonera_ensifolia',      latin: 'Scorzonera ensifolia',      name: 'Козелец мечелистный',                  status: 1 },
                      { id: 'tanacetum_millefolium',     latin: 'Tanacetum millefolium',     name: 'Пижма тысячелистная',                  status: 2 },
                      { id: 'pyrethrum_corymbosum',      latin: 'Pyrethrum corymbosum',      name: 'Пиретрум щитковидный',                 status: 1 },
                      { id: 'artemisia_gmelinii',        latin: 'Artemisia gmelinii',        name: 'Полынь Гмелина',                       status: 2 }
                    ]
                  },
                  {
                    label: 'Семейство Мареновые – Rubiaceae Juss.',
                    species: [
                      { id: 'galium_triflorum',          latin: 'Galium triflorum',          name: 'Подмаренник трёхцветковый',            status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Горечавковые – Gentianaceae Juss.',
                    species: [
                      { id: 'gentiana_cruciata',         latin: 'Gentiana cruciata',         name: 'Горечавка крестовидная',               status: 3 },
                      { id: 'centaurium_pulchellum',     latin: 'Centaurium pulchellum',     name: 'Золототысячник красивый',              status: 1 }
                    ]
                  },
                  {
                    label: 'Семейство Бурачниковые – Boraginaceae Juss.',
                    species: [
                      { id: 'onosma_borysthenica',       latin: 'Onosma borysthenica',       name: 'Оносма днепровская',                   status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Норичниковые – Scrophulariaceae Juss.',
                    species: [
                      { id: 'gratiola_officinalis',      latin: 'Gratiola officinalis',      name: 'Авран лекарственный',                  status: 2 },
                      { id: 'castilleja_pallida',        latin: 'Castilleja pallida',        name: 'Кастиллея бледная',                    status: 1 }
                    ]
                  },
                  {
                    label: 'Семейство Яснотковые (Губоцветные) – Lamiaceae Martinov (Labiatae Juss.)',
                    species: [
                      { id: 'nepeta_ucranica',           latin: 'Nepeta ucranica',           name: 'Котовник украинский',                  status: 2 }
                    ]
                  }
                ]
              },
              {
                label: 'Класс Лилиопсиды (Однодольные) – LILIOPSIDA (MONOCOTYLEDONES)',
                orders: [
                  {
                    label: 'Семейство Наядовые – Najadaceae Juss.',
                    species: [
                      { id: 'caulinia_minor',            latin: 'Caulinia minor',            name: 'Каулиния малая',                       status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Водокрасовые – Hydrocharitaceae Juss.',
                    species: [
                      { id: 'hydrilla_verticillata',     latin: 'Hydrilla verticillata',     name: 'Гидрилла мутовчатая',                  status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Частуховые – Alismataceae Vent.',
                    species: [
                      { id: 'sagittaria_trifolia',       latin: 'Sagittaria trifolia',       name: 'Стрелолист трёхлистный',               status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Лилейные – Liliaceae Juss.',
                    species: [
                      { id: 'gagea_fedtschenkoana',      latin: 'Gagea fedtschenkoana',      name: 'Гусиный лук Федченко',                 status: 1 },
                      { id: 'fritillaria_meleagroides',  latin: 'Fritillaria meleagroides',  name: 'Рябчик малый',                         status: 3 },
                      { id: 'tulipa_patens',             latin: 'Tulipa patens',             name: 'Тюльпан поникающий',                   status: 1 }
                    ]
                  },
                  {
                    label: 'Семейство Орхидные (Ятрышниковые) – Orchidaceae Juss.',
                    species: [
                      { id: 'cypripedium_calceolus',     latin: 'Cypripedium calceolus',     name: 'Башмачок известняковый (венерин)',     status: 3 },
                      { id: 'cypripedium_macranthon',    latin: 'Cypripedium macranthon',    name: 'Башмачок крупноцветковый',             status: 3 },
                      { id: 'cypripedium_guttatum',      latin: 'Cypripedium guttatum',      name: 'Башмачок пятнистый',                   status: 3 },
                      { id: 'neottia_nidus_avis',        latin: 'Neottia nidus-avis',        name: 'Гнездовка настоящая',                  status: 1 },
                      { id: 'epipactis_palustris',       latin: 'Epipactis palustris',       name: 'Дремлик болотный',                     status: 2 },
                      { id: 'epipactis_helleborine',     latin: 'Epipactis helleborine',     name: 'Дремлик зимовниковый',                 status: 1 },
                      { id: 'epipactis_atrorubens',      latin: 'Epipactis atrorubens',      name: 'Дремлик тёмно-красный',                status: 1 },
                      { id: 'calypso_bulbosa',           latin: 'Calypso bulbosa',           name: 'Калипсо луковичная',                   status: 1 },
                      { id: 'gymnadenia_conopsea',       latin: 'Gymnadenia conopsea',       name: 'Кокушник комарниковый',                status: 3 },
                      { id: 'corallorhiza_trifida',      latin: 'Corallorhiza trifida',      name: 'Ладьян трёхраздельный',                status: 1 },
                      { id: 'liparis_loeselii',          latin: 'Liparis loeselii',          name: 'Липарис Лёзеля',                       status: 2 },
                      { id: 'platanthera_bifolia',       latin: 'Platanthera bifolia',       name: 'Любка двулистная',                     status: 3 },
                      { id: 'malaxis_monophyllos',       latin: 'Malaxis monophyllos',       name: 'Мякотница однолистная',                status: 2 },
                      { id: 'epipogium_aphyllum',        latin: 'Epipogium aphyllum',        name: 'Надбородник безлистный',               status: 1 },
                      { id: 'neottianthe_cucullata',     latin: 'Neottianthe cucullata',     name: 'Неоттианте клобучковая',               status: 1 },
                      { id: 'dactylorhiza_longifolia',   latin: 'Dactylorhiza longifolia',   name: 'Пальчатокоренник длиннолистный',       status: 4 },
                      { id: 'dactylorhiza_incarnata',    latin: 'Dactylorhiza incarnata',    name: 'Пальчатокоренник мясо-красный',        status: 3 },
                      { id: 'dactylorhiza_maculata',     latin: 'Dactylorhiza maculata',     name: 'Пальчатокоренник пятнистый',           status: 3 },
                      { id: 'dactylorhiza_russowii',     latin: 'Dactylorhiza russowii',     name: 'Пальчатокоренник Руссова',             status: 2 },
                      { id: 'coeloglossum_viride',       latin: 'Coeloglossum viride',       name: 'Пололепестник зелёный',                status: 3 },
                      { id: 'spiranthes_sinensis',       latin: 'Spiranthes sinensis',       name: 'Скрученник китайский',                 status: 4 },
                      { id: 'listera_cordata',           latin: 'Listera cordata',           name: 'Тайник сердцевидный',                  status: 0 },
                      { id: 'listera_ovata',             latin: 'Listera ovata',             name: 'Тайник яйцевидный',                    status: 3 },
                      { id: 'hammarbya_paludosa',        latin: 'Hammarbya paludosa',        name: 'Хаммарбия болотная',                   status: 1 },
                      { id: 'neotinea_ustulata',         latin: 'Neotinea ustulata',         name: 'Неотинея обожжённая',                  status: 1 },
                      { id: 'orchis_militaris',          latin: 'Orchis militaris',          name: 'Ятрышник шлемоносный',                 status: 2 }
                    ]
                  },
                  {
                    label: 'Семейство Ирисовые (Касатиковые) – Iridaceae Juss.',
                    species: [
                      { id: 'iris_humilis',              latin: 'Iris humilis',              name: 'Ирис низкий',                          status: 3 },
                      { id: 'iris_glaucеscens',          latin: 'Iris glaucescens Bunge (I. scariosa auct.)',          name: 'Ирис сизоватый',                       status: 1 }
                    ]
                  },
                  {
                    label: 'Семейство Гиацинтовые – Hyacinthaceae Batsch ex Borkh.',
                    species: [
                      { id: 'ornithogalum_fischerianum', latin: 'Ornithogalum fischerianum', name: 'Птицемлечник Фишера',                  status: 0 }
                    ]
                  },
                  {
                    label: 'Семейство Луковые – Alliaceae Borkh.',
                    species: [
                      { id: 'allium_ramosum',            latin: 'Allium ramosum',            name: 'Лук ветвистый',                        status: 1 },
                      { id: 'allium_flavescens',         latin: 'Allium flavescens',         name: 'Лук желтеющий',                        status: 2 },
                      { id: 'allium_microdictyon',       latin: 'Allium microdictyon',       name: 'Лук мелкосетчатый (черемша)',          status: 3 },
                      { id: 'allium_pallasii',           latin: 'Allium pallasii',           name: 'Лук Палласа',                          status: 1 },
                      { id: 'allium_praescissum',        latin: 'Allium praescissum',        name: 'Лук предвиденный',                     status: 1 },
                      { id: 'allium_clathratum',         latin: 'Allium clathratum',         name: 'Лук решётчатый',                       status: 1 }
                    ]
                  },
                  {
                    label: 'Семейство Спаржевые – Asparagaceae Juss.',
                    species: [
                      { id: 'asparagus_pallasii',        latin: 'Asparagus pallasii',        name: 'Спаржа Палласа',                       status: 1 }
                    ]
                  },
                  {
                    label: 'Семейство Сытевые (Осоковые) – Cyperaceae Juss.',
                    species: [
                      { id: 'scirpus_ehrenbergii',       latin: 'Scirpus ehrenbergii',       name: 'Камыш Эренберга',                      status: 1 }
                    ]
                  },
                  {
                    label: 'Семейство Мятликовые (Злаки) – Poaceae Barnhart (Gramineae Juss.)',
                    species: [
                      { id: 'puccinellia_gigantea',      latin: 'Puccinellia gigantea',      name: 'Бескильница гигантская',               status: 3 },
                      { id: 'puccinellia_dolicholepis',  latin: 'Puccinellia dolicholepis',  name: 'Бескильница длинночешуйная',           status: 4 },
                      { id: 'stipa_zalesskii',           latin: 'Stipa zalesskii',           name: 'Ковыль Залесского',                    status: 2 },
                      { id: 'stipa_kirghisorum',         latin: 'Stipa kirghisorum',         name: 'Ковыль киргизский',                    status: 1 },
                      { id: 'stipa_korshinskyi',         latin: 'Stipa korshinskyi',         name: 'Ковыль Коржинского',                   status: 1 },
                      { id: 'stipa_pulcherrima',         latin: 'Stipa pulcherrima',         name: 'Ковыль красивейший',                   status: 0 },
                      { id: 'stipa_lessingiana',         latin: 'Stipa lessingiana',         name: 'Ковыль Лессинга',                      status: 2 },
                      { id: 'stipa_dasyphylla',          latin: 'Stipa dasyphylla',          name: 'Ковыль опушеннолистный',               status: 1 },
                      { id: 'stipa_pennata',             latin: 'Stipa pennata',             name: 'Ковыль перистый',                      status: 3 },
                      { id: 'stipa_praecapillata',       latin: 'Stipa praecapillata',       name: 'Ковыль предволосовидный',              status: 1 },
                      { id: 'stipa_tirsa',               latin: 'Stipa tirsa',               name: 'Ковыль узколистный',                   status: 1 },
                      { id: 'festuca_gigantea',          latin: 'Festuca gigantea',          name: 'Овсяница гигантская',                  status: 0 },
                      { id: 'crypsis_aculeata',          latin: 'Crypsis aculeata',          name: 'Скрытница колючая',                    status: 2 }
                    ]
                  }
                ]
              }
            ]
          },
          {
            label: 'Отдел Голосеменные (Хвойные) – PINOPHYTA (CONIFEROPHYTA)',
            orders: [
              {
                label: 'Класс Эфедровидные – EPHEDROPSIDA',
                orders: [
                  {
                    label: 'Семейство Эфедровые (Хвойниковые) – Ephedraceae Dumort.',
                    species: [
                      { id: 'ephedra_distachya',         latin: 'Ephedra distachya',         name: 'Хвойник двухколосковый',               status: 1 }
                    ]
                  }
                ]
              }
            ]
          },
          {
            label: 'Отдел Папоротниковидные – POLYPODIOPHYTA',
            orders: [
              {
                label: 'Класс Ужовниковые – OPHIOGLOSSOPISIDA',
                orders: [
                  {
                    label: 'Семейство Ужовниковые – Ophioglossaceae Martinov',
                    species: [
                      { id: 'ophioglossum_vulgatum',    latin: 'Ophioglossum vulgatum',    name: 'Ужовник обыкновенный',      status: 1 }
                    ]
                  },
                  {
                    label: 'Семейство Гроздовниковые – Botrychiaceae Horan.',
                    species: [
                      { id: 'botrychium_virginianum',   latin: 'Botrychium virginianum',   name: 'Гроздовник виргинский',     status: 2 },
                      { id: 'botrychium_multifidum',    latin: 'Botrychium multifidum',    name: 'Гроздовник многораздельный', status: 2 },
                      { id: 'botrychium_lunaria',       latin: 'Botrychium lunaria',       name: 'Гроздовник полулунный',     status: 1 }
                    ]
                  }
                ]
              },
              {
                label: 'Класс Многоножковые – POLYPODIOPSIDA',
                orders: [
                  {
                    label: 'Семейство Кочедыжниковые – Athyriaceae Alston',
                    species: [
                      { id: 'cystopteris_sudetica',     latin: 'Cystopteris sudetica',     name: 'Пузырник судетский',        status: 3 }
                    ]
                  }
                ]
              },
              {
                label: 'Класс Сальвиниевые – SALVINIOPISIDA',
                orders: [
                  {
                    label: 'Семейство Сальвиниевые – Salviniaceae Martinov',
                    species: [
                      { id: 'salvinia_natans',          latin: 'Salvinia natans',          name: 'Сальвиния плавающая',       status: 2 }
                    ]
                  }
                ]
              }
            ]
          },
          {
            label: 'Отдел Хвощевидные – EQUISETOPHYTA',
            orders: [
              {
                label: 'Класс Хвощевидные – EQUISETOPSIDA',
                orders: [
                  {
                    label: 'Семейство Хвощевые – Equisetaceae Rich. ex DC.',
                    species: [
                      { id: 'equisetum_ramosissimum', latin: 'Equisetum ramosissimum', name: 'Хвощ ветвистый', status: 3 }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        label: 'Мохообразные',
        classes: [
          {
            label: 'Отдел Листостебельные мхи – BRYOPHYTA',
            orders: [
              {
                label: 'Класс Бриевые мхи – BRYOPSIDA',
                orders: [
                  {
                    label: 'Семейство Фиссиденсовые – Fissidentaceae Schimp.',
                    species: [
                      { id: 'fissidens_adianthoides',        latin: 'Fissidens adianthoides',        name: 'Фиссиденс адиантовидный',          status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Мезиевые – Meesiaceae Schimp.',
                    species: [
                      { id: 'paludella_squarrosa',           latin: 'Paludella squarrosa',           name: 'Палюделла оттопыренная',           status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Бриевые – Bryaceae Schwägr.',
                    species: [
                      { id: 'bryum_neodamense',              latin: 'Bryum neodamense',              name: 'Бриум нейдаммский',                status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Плагиотециевые – Plagiotheciaceae (Broth.) M. Fleisch.',
                    species: [
                      { id: 'plagiothecium_latebricola',     latin: 'Plagiothecium latebricola',     name: 'Плагиотециум скрытный',            status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Брахитециевые – Brachytheciaceae Schimp.',
                    species: [
                      { id: 'cirriphyllum_piliferum',        latin: 'Cirriphyllum piliferum',        name: 'Циррифиллум волосконосный',        status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Каллиергоновые – Calliergonaceae (Kanda) Vanderp., Hedenäs, C. J. Cox et A. J. Shaw',
                    species: [
                      { id: 'conardia_compacta',             latin: 'Conardia compacta',             name: 'Конардия компактная',              status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Амблистегиевые – Amblystegiaceae G. Roth',
                    species: [
                      { id: 'pseudocalliergon_lycopodioides', latin: 'Pseudocalliergon lycopodioides', name: 'Псевдокаллиергон плауновидный', status: 2 },
                      { id: 'pseudocalliergon_trifarium',    latin: 'Pseudocalliergon trifarium',    name: 'Псевдокаллиергон трёхрядный',      status: 3 }
                    ]
                  }
                ]
              }
            ]
          },
          {
            label: 'Отдел Печёночные мхи – HEPATICOPHYTA',
            orders: [
              {
                label: 'Класс Маршанциевые – MARCHANTIOPSIDA',
                orders: [
                  {
                    label: 'Семейство Риччиевые – Ricciaceae Rchb.',
                    species: [
                      { id: 'ricciocarpos_natans',    latin: 'Ricciocarpos natans',    name: 'Риччиокарпос плавающий',       status: 3 }
                    ]
                  }
                ]
              },
              {
                label: 'Класс Юнгерманниевые – JUNGERMANNIOPSIDA',
                orders: [
                  {
                    label: 'Семейство Цефалозиевые – Cephaloziaceae Mig.',
                    species: [
                      { id: 'cephalozia_pleniceps',   latin: 'Cephalozia pleniceps',   name: 'Цефалозия обильноголовая',     status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Скапаниевые – Scapaniaceae Mig.',
                    species: [
                      { id: 'crossocalyx_hellerianus', latin: 'Crossocalyx hellerianus', name: 'Кроссокаликс Геллера',       status: 3 },
                      { id: 'heterogemma_capitata',   latin: 'Heterogemma capitata',   name: 'Гетерогемма головчатая',       status: 3 }
                    ]
                  },
                  {
                    label: 'Семейство Геокаликсовые – Geocalycaceae H. Klinggr.',
                    species: [
                      { id: 'geocalyx_graveolens',    latin: 'Geocalyx graveolens',    name: 'Геокаликс пахучий',            status: 3 }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        label: 'Макроскопические водоросли',
        classes: [
          {
            label: 'Отдел Харовые водоросли – CHAROPHYTA',
            orders: [
              {
                label: 'Класс Харовые – CHAROPHYCEAE',
                orders: [
                  {
                    label: 'Семейство Харовые – Characeae Ag. emend. Hollerb.',
                    species: [
                      { id: 'chara_braunii',    latin: 'Chara braunii',    name: 'Хара Брауна',           status: 1 },
                      { id: 'chara_contraria',  latin: 'Chara contraria',  name: 'Хара противоположная',  status: 1 },
                      { id: 'chara_canescens',  latin: 'Chara canescens',  name: 'Хара седеющая',         status: 1 }
                    ]
                  }
                ]
              }
            ]
          },
          {
            label: 'Отдел Зелёные водоросли – CHLOROPHYTA',
            orders: [
              {
                label: 'Класс Конъюгаты (Сцеплянки) – ZYGNEMATOPHYCEAE',
                orders: [
                  {
                    label: 'Семейство Спирогировые – Spirogyraceae Palla',
                    species: [
                      { id: 'spirogyra_subcolligata', latin: 'Spirogyra subcolligata', name: 'Спирогира полусвязанная', status: 4 }
                    ]
                  }
                ]
              },
              {
                label: 'Класс Улотриксовые – ULOTRICHOPHYCEAE',
                orders: [
                  {
                    label: 'Семейство Ульвовые – Ulvaceae Lamour.',
                    species: [
                      { id: 'percursaria_percursa',   latin: 'Percursaria percursa',   name: 'Перкурсария пронизанная', status: 4 }
                    ]
                  }
                ]
              }
            ]
          },
          {
            label: 'Отдел Желтозелёные водоросли – XANTHOPHYTA',
            orders: [
              {
                label: 'Класс Гетеросифоновые (Ксантофитовые) – HETEROSIPHONOPHYCEAE (XANTHOPHYCEAE)',
                orders: [
                  {
                    label: 'Семейство Вошериевые – Vaucheriaceae (S. F. Gray) Dumort.',
                    species: [
                      { id: 'vaucheria_aversa', latin: 'Vaucheria aversa', name: 'Вошерия отвернутая', status: 4 }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  // ============================================================
  // ЛИШАЙНИКИ
  // ============================================================
  lichens: {
    label: 'Лишайники',
    classes: [
      {
        label: 'Лишайники',
        orders: [
          {
            label: 'Семейство Бацидиевые – Bacidiaceae Walt. Watson',
            species: [
              { id: 'bacidia_bagliettoana',    latin: 'Bacidia bagliettoana',    name: 'Бацидия Баглитто',                status: 2 },
              { id: 'bacidia_polychroa',       latin: 'Bacidia polychroa',       name: 'Бацидия многоцветная',            status: 3 },
              { id: 'toninia_sedifolia',       latin: 'Toninia sedifolia',       name: 'Тониния вздутолистная',           status: 1 }
            ]
          },
          {
            label: 'Семейство Кладониевые – Cladoniaceae Zenker',
            species: [
              { id: 'cladonia_foliacea',       latin: 'Cladonia foliacea',       name: 'Кладония листоватая',             status: 2 }
            ]
          },
          {
            label: 'Семейство Графидовые – Graphidaceae Dumort.',
            species: [
              { id: 'diploschistes_scruposus', latin: 'Diploschistes scruposus', name: 'Диплосхистес неровный',          status: 1 },
              { id: 'graphis_scripta',         latin: 'Graphis scripta',         name: 'Графис написанный',               status: 3 }
            ]
          },
          {
            label: 'Семейство Гиалектовые – Gyalectaceae Stizenb.',
            species: [
              { id: 'gyalecta_flotovii',       latin: 'Gyalecta flotovii',       name: 'Гиалекта Флотова',                status: 3 },
              { id: 'gyalecta_nigricans',      latin: 'Gyalecta nigricans',      name: 'Гиалекта чернеющая',              status: 3 }
            ]
          },
          {
            label: 'Семейство Леканоровые – Lecanoraceae Körb.',
            species: [
              { id: 'lecanora_dispersa',       latin: 'Lecanora dispersa',       name: 'Леканора рассеянная',             status: 2 },
              { id: 'lecanora_frustulosa',     latin: 'Lecanora frustulosa',     name: 'Леканора обломочная',             status: 2 },
              { id: 'lecanora_muralis',        latin: 'Lecanora muralis',        name: 'Леканора настенная',              status: 2 }
            ]
          },
          {
            label: 'Семейство Лобариевые – Lobariaceae Chevall.',
            species: [
              { id: 'dendriscocaulon_umhausense', latin: 'Dendriscocaulon umhausense', name: 'Дендрискокаулон Умгаузена',   status: 3 },
              { id: 'lobaria_pulmonaria',      latin: 'Lobaria pulmonaria',      name: 'Лобария лёгочная',                status: 1 }
            ]
          },
          {
            label: 'Семейство Пармелиевые – Parmeliaceae Zenker',
            species: [
              { id: 'evernia_prunastri',       latin: 'Evernia prunastri',       name: 'Еверния сливовая',                status: 4 },
              { id: 'everniastrum_cirratum',   latin: 'Everniastrum cirratum',   name: 'Еверниаструм усиковый',           status: 1 },
              { id: 'hypogymnia_enteromorpha', latin: 'Hypogymnia enteromorpha', name: 'Гипогимния энтероморфная',        status: 3 },
              { id: 'menegazzia_terebrata',    latin: 'Menegazzia terebrata',    name: 'Менегацция пробуравленная',       status: 0 },
              { id: 'neofuscelia_ryssolea',    latin: 'Neofuscelia ryssolea',    name: 'Неофусцелия грубоморщинистая',    status: 2 },
              { id: 'parmelina_quercina',      latin: 'Parmelina quercina',      name: 'Пармелина дубовая',               status: 4 },
              { id: 'parmelina_tiliacea',      latin: 'Parmelina tiliacea',      name: 'Пармелина липовая',               status: 3 },
              { id: 'usnea_wasmuthii',         latin: 'Usnea wasmuthii',         name: 'Уснея Васмута',                   status: 3 },
              { id: 'xanthoparmelia_camtschadalis', latin: 'Xanthoparmelia camtschadalis', name: 'Ксантопармелия камчатская', status: 3 }
            ]
          },
          {
            label: 'Семейство Псоровые – Psoraceae Zahlbr.',
            species: [
              { id: 'psora_decipiens',         latin: 'Psora decipiens',         name: 'Псора обманная',                  status: 1 }
            ]
          },
          {
            label: 'Семейство Рамалиновые – Ramalinaceae C. Agardh',
            species: [
              { id: 'ramalina_calicaris',      latin: 'Ramalina calicaris',      name: 'Рамалина чашечковая',             status: 3 }
            ]
          },
          {
            label: 'Семейство Сфинктриновые – Sphinctrinaceae M. Choisy',
            species: [
              { id: 'sphinctrina_turbinata',   latin: 'Sphinctrina turbinata',   name: 'Сфинктрина кубарчатая',           status: 3 }
            ]
          },
          {
            label: 'Семейство Телосхистовые – Teloschistaceae Zahlbr.',
            species: [
              { id: 'caloplaca_vitellinula',   latin: 'Caloplaca vitellinula',   name: 'Калоплака желточно-жёлтая',       status: 2 }
            ]
          },
          {
            label: 'Семейство Веррукариевые – Verrucariaceae Zenker',
            species: [
              { id: 'verrucaria_nigrescens',   latin: 'Verrucaria nigrescens',   name: 'Веррукария черноватая',           status: 3 }
            ]
          }
        ]
      }
    ]
  },

  // ============================================================
  // ГРИБЫ
  // ============================================================
  fungi: {
    label: 'Грибы',
    classes: [
      {
        label: 'Отдел Базидиомицеты – BASIDIOMYCOTA',
        orders: [
          {
            label: 'Класс Базидиальные грибы – BASIDIOMYCETES',
            orders: [
              {
                label: 'Порядок Геастровые (Звездовиковые) – GEASTRALES',
                orders: [
                  {
                    label: 'Семейство Геастровые (Звездовиковые) – Geastraceae Corda',
                    species: [
                      { id: 'geastrum_campestre', latin: 'Geastrum campestre', name: 'Звездовик полевой',       status: 2 }
                    ]
                  }
                ]
              },
              {
                label: 'Порядок Фаллюсовые (Веселювые) – PHALLALES',
                orders: [
                  {
                    label: 'Семейство Фаллюсовые (Веселювые) – Phallaceae Corda',
                    species: [
                      { id: 'mutinus_caninus',    latin: 'Mutinus caninus',    name: 'Мутинус собачий',          status: 3 }
                    ]
                  }
                ]
              },
              {
                label: 'Порядок Полипоровые – POLYPORALES',
                orders: [
                  {
                    label: 'Семейство Спарассиевые – Sparassidaceae Herter',
                    species: [
                      { id: 'sparassis_crispa',   latin: 'Sparassis crispa',   name: 'Спарассис курчавый',       status: 3 }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
};