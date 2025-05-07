// Inicializar Firebase (já configurado no index.html)
const auth = firebase.auth();
const database = firebase.database();

// Variáveis globais
let tarefas = [];
let modoVisualizacao = "lista";
let draggedItem = null;
let calendar = null;
let pomodoroInterval;
let tempoInicio = null;
let duracaoTotal = 1500; // 25 minutos em segundos
let pausado = true;
let chartInstance = null;

// Função para tocar som com fallback
function tocarSom(somId) {
  try {
    const som = document.getElementById(somId);
    if (som.readyState !== 4) {
      console.warn(`Áudio ${somId} não está carregado (readyState: ${som.readyState})`);
      mostrarToast("⚠️ Não foi possível tocar o som. Verifique os arquivos de áudio.");
      return;
    }
    som.play();
  } catch (error) {
    console.error(`Erro ao tocar ${somId}:`, error);
    mostrarToast("⚠️ Erro ao tocar o som.");
  }
}

// Função para carregar tarefas do Firebase no modo Lista
function carregarTarefas() {
  const user = auth.currentUser;
  if (!user) {
    document.getElementById("listaTarefas").innerHTML = "";
    atualizarContador();
    return;
  }

  const tasksRef = database.ref(`tasks/${user.uid}`);
  tasksRef.on('value', snapshot => {
    tarefas = [];
    const data = snapshot.val() || {};
    Object.entries(data).forEach(([id, tarefa]) => {
      tarefas.push({ id, ...tarefa });
    });

    const lista = document.getElementById("listaTarefas");
    lista.innerHTML = "";
    const agora = new Date();

    const filtroCategoria = document.getElementById("filtroCategoria").value;
    const filtroStatus = document.getElementById("filtroStatus").value;
    const ordenarPor = document.getElementById("ordenarTarefas").value;

    let tarefasFiltradas = tarefas.filter(tarefa => {
      const categoriaMatch = filtroCategoria === "todas" || tarefa.categoria === filtroCategoria;
      const statusMatch = filtroStatus === "todas" || (filtroStatus === "pendentes" && !tarefa.feito) || (filtroStatus === "concluídas" && tarefa.feito);
      return categoriaMatch && statusMatch;
    });

    if (ordenarPor === "prazo") {
      tarefasFiltradas.sort((a, b) => new Date(a.prazo || "9999-12-31") - new Date(b.prazo || "9999-12-31"));
    } else if (ordenarPor === "prioridade") {
      const prioridadeOrdem = { alta: 1, média: 2, baixa: 3 };
      tarefasFiltradas.sort((a, b) => prioridadeOrdem[a.prioridade] - prioridadeOrdem[b.prioridade]);
    }

    tarefasFiltradas.forEach(({ id, texto, categoria, prazo, feito, recorrente, prioridade, tags }, index) => {
      const li = document.createElement("li");
      li.className = "animada";
      li.dataset.id = id;
      if (feito) li.classList.add("feito");

      if (prazo && !feito) {
        const prazoDate = new Date(prazo);
        const diffDias = Math.ceil((prazoDate - agora) / (1000 * 60 * 60 * 24));
        if (diffDias < 0) {
          li.classList.add("tarefa-vencida");
        } else if (diffDias <= 1) {
          li.classList.add("tarefa-vence-em-breve");
        }
      }

      const dataPrazo = prazo ? `<small class="prazo">⏰ ${prazo}</small>` : "";
      const dataPrioridade = prioridade ? `<small class="prioridade">Prioridade: ${prioridade}</small>` : "";
      const dataTags = tags && tags.length ? `<small class="tags">Tags: ${tags.join(", ")}</small>` : "";
      li.innerHTML = `
        <span class="${feito ? 'concluida' : ''}">${texto} <small>[${categoria}]</small> ${dataPrazo} ${dataPrioridade} ${dataTags}</span>
        <button class="btn-check" onclick="concluirTarefa(this)">✔️</button>
        <button onclick="editarTarefa(this)">✏️</button>
        <button onclick="removerTarefa(this)">🗑️</button>
        <button onclick="reagendarTarefa(this)">📅</button>
      `;
      lista.appendChild(li);
    });

    atualizarContador();
    atualizarHistorico();
    if (modoVisualizacao === "kanban") carregarTarefasKanban();
    if (modoVisualizacao === "calendario") carregarTarefasCalendario();
    atualizarGrafico();
  }, err => {
    console.error("Erro ao carregar tarefas:", err);
    mostrarToast("⚠️ Erro ao carregar tarefas!");
  });
}

// Função para alternar entre modos de visualização
function alternarModoVisualizacao(modo) {
  console.log(`Alternando para o modo: ${modo}`);
  const modoListaBtn = document.getElementById("modoLista");
  const modoKanbanBtn = document.getElementById("modoKanban");
  const modoCalendarioBtn = document.getElementById("modoCalendario");

  if (!modoListaBtn || !modoKanbanBtn || !modoCalendarioBtn) {
    console.error("Um ou mais botões de modo não foram encontrados!");
    return;
  }

  modoListaBtn.classList.remove("modo-ativo");
  modoKanbanBtn.classList.remove("modo-ativo");
  modoCalendarioBtn.classList.remove("modo-ativo");

  const listaTarefas = document.getElementById("listaTarefas");
  const kanbanView = document.getElementById("kanbanView");
  const calendarioView = document.getElementById("calendarioView");

  if (!listaTarefas || !kanbanView || !calendarioView) {
    console.error("Uma ou mais seções de visualização não foram encontradas!");
    return;
  }

  listaTarefas.style.display = "none";
  kanbanView.style.display = "none";
  calendarioView.style.display = "none";

  if (modo === "lista") {
    console.log("Exibindo modo Lista");
    listaTarefas.style.display = "block";
    modoListaBtn.classList.add("modo-ativo");
    carregarTarefas();
  } else if (modo === "kanban") {
    console.log("Exibindo modo Kanban");
    kanbanView.style.display = "flex";
    modoKanbanBtn.classList.add("modo-ativo");
    carregarTarefasKanban();
  } else if (modo === "calendario") {
    console.log("Exibindo modo Calendário");
    calendarioView.style.display = "block";
    modoCalendarioBtn.classList.add("modo-ativo");
    carregarTarefasCalendario();
  }

  modoVisualizacao = modo;
}

// Função para carregar tarefas no modo Kanban
function carregarTarefasKanban() {
  try {
    const aFazer = document.querySelector("#aFazer .kanban-tasks");
    const emProgresso = document.querySelector("#emProgresso .kanban-tasks");
    const concluido = document.querySelector("#concluido .kanban-tasks");

    if (!aFazer || !emProgresso || !concluido) {
      console.error("Uma ou mais colunas do Kanban não foram encontradas!");
      return;
    }

    aFazer.innerHTML = "";
    emProgresso.innerHTML = "";
    concluido.innerHTML = "";
    const agora = new Date();

    tarefas.forEach((tarefa) => {
      const li = document.createElement("li");
      li.className = "animada";
      li.draggable = true;
      li.dataset.id = tarefa.id;
      if (tarefa.feito) li.classList.add("feito");

      if (tarefa.prazo && !tarefa.feito) {
        const prazoDate = new Date(tarefa.prazo);
        const diffDias = Math.ceil((prazoDate - agora) / (1000 * 60 * 60 * 24));
        if (diffDias < 0) {
          li.classList.add("tarefa-vencida");
        } else if (diffDias <= 1) {
          li.classList.add("tarefa-vence-em-breve");
        }
      }

      const dataPrazo = tarefa.prazo ? `<small class="prazo">⏰ ${tarefa.prazo}</small>` : "";
      const dataPrioridade = tarefa.prioridade ? `<small class="prioridade">Prioridade: ${tarefa.prioridade}</small>` : "";
      li.innerHTML = `
        <span class="${tarefa.feito ? 'concluida' : ''}">${tarefa.texto} <small>[${tarefa.categoria}]</small> ${dataPrazo} ${dataPrioridade}</span>
        <button class="btn-check" onclick="concluirTarefa(this)">✔️</button>
        <button onclick="editarTarefa(this)">✏️</button>
        <button onclick="removerTarefa(this)">🗑️</button>
        <button onclick="reagendarTarefa(this)">📅</button>
      `;
      li.addEventListener("dragstart", dragStart);
      li.addEventListener("dragend", dragEnd);

      if (tarefa.feito) {
        concluido.appendChild(li);
      } else if (tarefa.emProgresso) {
        emProgresso.appendChild(li);
      } else {
        aFazer.appendChild(li);
      }
    });
  } catch (error) {
    console.error("Erro ao carregar tarefas no modo Kanban:", error);
  }
}

// Funções de Drag and Drop para o Kanban
function dragStart(event) {
  draggedItem = event.target;
  setTimeout(() => {
    event.target.style.opacity = "0.5";
  }, 0);
}

function dragEnd(event) {
  draggedItem.style.opacity = "1";
  draggedItem = null;
}

function allowDrop(event) {
  event.preventDefault();
}

function drop(event) {
  event.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const targetColumn = event.target.closest(".kanban-column").id;
  const taskId = draggedItem.dataset.id;

  const updates = {
    emProgresso: targetColumn === "emProgresso",
    feito: targetColumn === "concluido"
  };

  database.ref(`tasks/${user.uid}/${taskId}`).update(updates)
    .then(() => {
      if (updates.feito) {
        draggedItem.classList.add("feito");
        draggedItem.querySelector("span").classList.add("concluida");
        tocarSom("somAdicionar");
      } else {
        draggedItem.classList.remove("feito");
        draggedItem.querySelector("span").classList.remove("concluida");
      }
    })
    .catch(err => {
      console.error("Erro ao atualizar tarefa:", err);
      mostrarToast("⚠️ Erro ao mover tarefa!");
    });
}

// Função para carregar tarefas no modo Calendário
function carregarTarefasCalendario() {
  try {
    const calendarEl = document.getElementById("calendario");
    if (!calendarEl) {
      console.error("Elemento do calendário não encontrado!");
      return;
    }

    if (calendar) {
      calendar.destroy();
    }

    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      events: tarefas
        .filter(tarefa => tarefa.prazo)
        .map(tarefa => ({
          title: tarefa.texto,
          start: tarefa.prazo,
          allDay: true,
          backgroundColor: tarefa.feito ? "#4CAF50" : "#FF9900",
        })),
      eventClick: function(info) {
        alert(`Tarefa: ${info.event.title}\nPrazo: ${info.event.start.toISOString().split("T")[0]}`);
      },
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,dayGridWeek",
      },
    });

    calendar.render();
  } catch (error) {
    console.error("Erro ao carregar tarefas no modo Calendário:", error);
  }
}

// Função para adicionar tarefa
function adicionarTarefa() {
  const user = auth.currentUser;
  if (!user) {
    mostrarToast("⚠️ Faça login para adicionar tarefas!");
    return;
  }

  const inputTarefa = document.getElementById("novaTarefa");
  const categoria = document.getElementById("categoria").value;
  const prazo = document.getElementById("prazoTarefa").value;
  const recorrente = document.getElementById("tarefaRecorrente").checked;
  const prioridade = document.getElementById("prioridadeTarefa").value;
  const tagsInput = document.getElementById("tagsTarefa").value;
  const texto = inputTarefa.value.trim();

  if (!texto) {
    mostrarToast("⚠️ Insira uma descrição para a tarefa!");
    return;
  }

  if (!categoria) {
    mostrarToast("⚠️ Selecione uma categoria!");
    return;
  }

  if (!prioridade) {
    mostrarToast("⚠️ Selecione uma prioridade!");
    return;
  }

  const tags = tagsInput.split(",").map(tag => tag.trim()).filter(tag => tag);
  const novaTarefa = {
    texto,
    categoria,
    prazo: prazo || null,
    feito: false,
    recorrente,
    emProgresso: false,
    prioridade,
    tags,
    historico: [{
      acao: "Criada",
      data: new Date().toISOString()
    }]
  };

  database.ref(`tasks/${user.uid}`).push(novaTarefa)
    .then(() => {
      tocarSom("somAdicionar");
      mostrarToast("✅ Tarefa adicionada com sucesso!");
      inputTarefa.value = "";
      document.getElementById("tagsTarefa").value = "";
      document.getElementById("prazoTarefa").value = "";
      document.getElementById("tarefaRecorrente").checked = false;
    })
    .catch(err => {
      console.error("Erro ao adicionar tarefa:", err);
      mostrarToast("⚠️ Erro ao adicionar tarefa!");
    });
}

// Função para concluir tarefa
function concluirTarefa(btn) {
  const user = auth.currentUser;
  if (!user) return;

  const li = btn.parentElement;
  const taskId = li.dataset.id;
  const tarefa = tarefas.find(t => t.id === taskId);

  const updates = {
    feito: !tarefa.feito,
    emProgresso: false,
    historico: [...tarefa.historico, {
      acao: !tarefa.feito ? "Concluída" : "Marcada como pendente",
      data: new Date().toISOString()
    }]
  };

  database.ref(`tasks/${user.uid}/${taskId}`).update(updates)
    .then(() => {
      if (updates.feito) {
        tocarSom("somAdicionar");
      }

      if (updates.feito && tarefa.recorrente) {
        let novoPrazo = "";
        if (tarefa.prazo) {
          const prazoDate = new Date(tarefa.prazo);
          prazoDate.setDate(prazoDate.getDate() + 1);
          novoPrazo = prazoDate.toISOString().split("T")[0];
        }
        database.ref(`tasks/${user.uid}`).push({
          texto: tarefa.texto,
          categoria: tarefa.categoria,
          prazo: novoPrazo,
          feito: false,
          recorrente: true,
          emProgresso: false,
          prioridade: tarefa.prioridade,
          tags: tarefa.tags,
          historico: [{
            acao: "Criada (recorrente)",
            data: new Date().toISOString()
          }]
        });
      }
    })
    .catch(err => {
      console.error("Erro ao concluir tarefa:", err);
      mostrarToast("⚠️ Erro ao concluir tarefa!");
    });
}

// Função para remover tarefa
function removerTarefa(btn) {
  const user = auth.currentUser;
  if (!user) return;

  const li = btn.parentElement;
  const taskId = li.dataset.id;
  const tarefa = tarefas.find(t => t.id === taskId);

  database.ref(`tasks/${user.uid}/${taskId}`).update({
    historico: [...tarefa.historico, {
      acao: "Removida",
      data: new Date().toISOString()
    }]
  }).then(() => {
    database.ref(`tasks/${user.uid}/${taskId}`).remove()
      .then(() => {
        tocarSom("somRemover");
        mostrarToast("🗑️ Tarefa removida!");
      })
      .catch(err => {
        console.error("Erro ao remover tarefa:", err);
        mostrarToast("⚠️ Erro ao remover tarefa!");
      });
  });
}

// Função para reagendar tarefa
function reagendarTarefa(btn) {
  const user = auth.currentUser;
  if (!user) return;

  const li = btn.parentElement;
  const taskId = li.dataset.id;
  const tarefa = tarefas.find(t => t.id === taskId);

  const novoPrazo = prompt("Digite o novo prazo (formato: AAAA-MM-DD):");
  if (novoPrazo) {
    database.ref(`tasks/${user.uid}/${taskId}`).update({
      prazo: novoPrazo,
      historico: [...tarefa.historico, {
        acao: "Prazo alterado para " + novoPrazo,
        data: new Date().toISOString()
      }]
    }).catch(err => {
      console.error("Erro ao reagendar tarefa:", err);
      mostrarToast("⚠️ Erro ao reagendar tarefa!");
    });
  }
}

// Função para editar tarefa
function editarTarefa(btn) {
  const user = auth.currentUser;
  if (!user) return;

  const li = btn.parentElement;
  const taskId = li.dataset.id;
  const tarefa = tarefas.find(t => t.id === taskId);

  const novoTexto = prompt("Editar tarefa:", tarefa.texto);
  if (novoTexto === null || novoTexto.trim() === "") return;

  const novaCategoria = prompt("Nova categoria (Pessoal, Trabalho, Estudos, Outros):", tarefa.categoria);
  const novoPrazo = prompt("Novo prazo (formato AAAA-MM-DD, deixe vazio para remover):", tarefa.prazo);
  const novaPrioridade = prompt("Nova prioridade (baixa, média, alta):", tarefa.prioridade);

  database.ref(`tasks/${user.uid}/${taskId}`).update({
    texto: novoTexto,
    categoria: novaCategoria || tarefa.categoria,
    prazo: novoPrazo || "",
    prioridade: novaPrioridade || tarefa.prioridade,
    historico: [...tarefa.historico, {
      acao: "Editada",
      data: new Date().toISOString()
    }]
  }).catch(err => {
    console.error("Erro ao editar tarefa:", err);
    mostrarToast("⚠️ Erro ao editar tarefa!");
  });
}

// Função para atualizar o contador
function atualizarContador() {
  const total = tarefas.length;
  const pendentes = tarefas.filter(t => !t.feito).length;
  document.getElementById("total").textContent = `Total: ${total}`;
  document.getElementById("pendentes").textContent = `Pendentes: ${pendentes}`;
}

// Função para mostrar toast
function mostrarToast(mensagem) {
  const toast = document.getElementById("toast");
  toast.textContent = mensagem;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Função para solicitar permissão de notificações
function solicitarPermissaoNotificacoes() {
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('Permissão para notificações concedida!');
        mostrarToast('✅ Permissão para notificações concedida!');
      } else {
        console.log('Permissão para notificações negada.');
        mostrarToast('⚠️ Permissão para notificações negada.');
      }
    });
  }
}

// Função para verificar prazos
function verificarPrazos() {
  const agora = new Date();
  tarefas.forEach(tarefa => {
    if (tarefa.prazo && !tarefa.feito) {
      const prazoDate = new Date(tarefa.prazo);
      const diffHoras = (prazoDate - agora) / (1000 * 60 * 60);
      if (diffHoras <= 0) {
        mostrarToast(`⚠️ A tarefa "${tarefa.texto}" está vencida!`);
      } else if (diffHoras <= 24) {
        mostrarToast(`⏰ A tarefa "${tarefa.texto}" vence em breve!`);
        if ('serviceWorker' in navigator && Notification.permission === 'granted') {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('Tarefa Perto de Vencer', {
              body: `A tarefa "${tarefa.texto}" vence em breve!`,
              icon: './icon.png',
            });
          });
        }
      }
    }
  });
}

// Função para atualizar o gráfico
function atualizarGrafico() {
  const ctx = document.getElementById("graficoTarefas").getContext("2d");
  const categorias = ["Pessoal", "Trabalho", "Estudos", "Outros"];
  const concluidasPorCategoria = categorias.map(categoria =>
    tarefas.filter(t => t.categoria === categoria && t.feito).length
  );

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: categorias,
      datasets: [{
        label: "Tarefas Concluídas",
        data: concluidasPorCategoria,
        backgroundColor: "rgba(75, 192, 192, 0.5)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// Função para alternar tema
function alternarTema() {
  const root = document.documentElement;
  const temaAtual = root.classList.contains("tema-claro") ? "claro" : "escuro";
  if (temaAtual === "claro") {
    root.classList.remove("tema-claro");
    localStorage.setItem("tema", "escuro");
    mostrarToast("Tema alterado para escuro!");
  } else {
    root.classList.add("tema-claro");
    localStorage.setItem("tema", "claro");
    mostrarToast("Tema alterado para claro!");
  }
}

// Função para carregar tema
function carregarTema() {
  const temaSalvo = localStorage.getItem("tema") || "escuro";
  const root = document.documentElement;
  if (temaSalvo === "claro") {
    root.classList.add("tema-claro");
  } else {
    root.classList.remove("tema-claro");
  }
}

// Função para exportar como TXT
function exportarTXT() {
  if (tarefas.length === 0) {
    mostrarToast("⚠️ Não há tarefas para exportar!");
    return;
  }
  const texto = tarefas.map(t => `${t.texto} [${t.categoria}] ${t.prazo ? `⏰ ${t.prazo}` : ''} ${t.feito ? '✔️' : ''}`).join("\n");
  const blob = new Blob([texto], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tarefas.txt";
  a.click();
  URL.revokeObjectURL(url);
  mostrarToast("✅ Tarefas exportadas para TXT!");
}

// Função para exportar como PDF
function exportarPDF() {
  if (tarefas.length === 0) {
    mostrarToast("⚠️ Não há tarefas para exportar!");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Minha Lista de Tarefas", 10, 10);
  let y = 20;
  tarefas.forEach(t => {
    doc.text(`${t.texto} [${t.categoria}] ${t.prazo ? `⏰ ${t.prazo}` : ''} ${t.feito ? '✔️' : ''}`, 10, y);
    y += 10;
  });
  doc.save("tarefas.pdf");
  mostrarToast("✅ Tarefas exportadas para PDF!");
}

// Função para exportar como Excel
function exportarExcel() {
  console.log("Iniciando exportação para Excel...");
  if (!tarefas || tarefas.length === 0) {
    mostrarToast("Nenhuma tarefa para exportar!");
    console.log("Nenhuma tarefa disponível.");
    return;
  }

  if (typeof XLSX === "undefined") {
    mostrarToast("⚠️ Biblioteca SheetJS não carregada!");
    console.error("SheetJS não está disponível. Verifique o carregamento do script.");
    return;
  }

  try {
    console.log("Formatando dados para Excel...");
    const filtroCategoria = document.getElementById("filtroCategoria").value;
    const filtroStatus = document.getElementById("filtroStatus").value || "todas";
    let tarefasFiltradas = tarefas;

    if (filtroCategoria && filtroCategoria !== "todas") {
      tarefasFiltradas = tarefasFiltradas.filter(t => t.categoria === filtroCategoria);
    }

    if (filtroStatus && filtroStatus !== "todas") {
      tarefasFiltradas = tarefasFiltradas.filter(t => 
        filtroStatus === "concluídas" ? t.feito : !t.feito
      );
    }

    const dadosExcel = tarefasFiltradas
      .filter(tarefa => tarefa && typeof tarefa === "object")
      .map(tarefa => ({
        Tarefa: tarefa.texto || "Sem descrição",
        Categoria: tarefa.categoria || "Sem categoria",
        Prazo: tarefa.prazo || "Sem prazo",
        Status: tarefa.feito ? "Concluída" : "Pendente",
        Recorrente: tarefa.recorrente ? "Sim" : "Não",
        Prioridade: tarefa.prioridade || "Média"
      }));

    if (dadosExcel.length === 0) {
      mostrarToast("⚠️ Nenhuma tarefa válida para exportar com os filtros aplicados!");
      console.log("Nenhuma tarefa válida após filtragem.");
      return;
    }

    console.log("Dados formatados:", dadosExcel);
    const worksheet = XLSX.utils.json_to_sheet(dadosExcel);
    console.log("Planilha criada:", worksheet);

    worksheet['!cols'] = [
      { wch: 30 }, // Tarefa
      { wch: 15 }, // Categoria
      { wch: 15 }, // Prazo
      { wch: 10 }, // Status
      { wch: 10 }, // Recorrente
      { wch: 10 }  // Prioridade
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tarefas");
    console.log("Workbook criado:", workbook);

    XLSX.writeFile(workbook, "Lista_de_Tarefas_Filtrada.xlsx");
    console.log("Download iniciado.");
    mostrarToast("✅ Tarefas filtradas exportadas para Excel!");
  } catch (error) {
    console.error("Erro ao exportar para Excel:", error);
    mostrarToast("⚠️ Erro ao exportar para Excel: " + error.message);
  }
}

// Função para limpar tudo
function limparTudo() {
  const user = auth.currentUser;
  if (!user) return;

  if (tarefas.length === 0) {
    mostrarToast("⚠️ Não há tarefas para limpar!");
    return;
  }
  if (confirm("Tem certeza que deseja limpar todas as tarefas?")) {
    database.ref(`tasks/${user.uid}`).remove()
      .then(() => {
        tarefas = [];
        mostrarToast("🗑️ Todas as tarefas foram removidas!");
      })
      .catch(err => {
        console.error("Erro ao limpar tarefas:", err);
        mostrarToast("⚠️ Erro ao limpar tarefas!");
      });
  }
}

// Função para filtrar tarefas
function filtrarTarefas() {
  carregarTarefas(); // Recarrega com filtros aplicados
}

// Função para ordenar tarefas
function ordenarTarefas() {
  carregarTarefas(); // Recarrega com ordenação aplicada
}

// Função para atualizar o histórico
function atualizarHistorico() {
  const listaHistorico = document.getElementById("listaHistorico");
  listaHistorico.innerHTML = "";
  
  tarefas.forEach(tarefa => {
    tarefa.historico.forEach(evento => {
      const li = document.createElement("li");
      const dataFormatada = new Date(evento.data).toLocaleString("pt-BR");
      li.textContent = `[${dataFormatada}] Tarefa "${tarefa.texto}": ${evento.acao}`;
      listaHistorico.appendChild(li);
    });
  });
}

// Função para iniciar o Pomodoro
function iniciarPomodoro() {
  if (!pausado) return;
  pausado = false;
  document.querySelector(".pomodoro").classList.remove("pausado");

  if (tempoInicio === null) {
    const minutos = parseInt(document.getElementById("entradaMinutos").value) || 25;
    duracaoTotal = minutos * 60;
    tempoInicio = Date.now();
  } else {
    tempoInicio = Date.now() - (duracaoTotal - Math.floor(duracaoTotal));
  }

  atualizarTempo();
  pomodoroInterval = setInterval(() => {
    if (!pausado) {
      const tempoDecorrido = Math.floor((Date.now() - tempoInicio) / 1000);
      const tempoRestante = duracaoTotal - tempoDecorrido;
      if (tempoRestante <= 0) {
        clearInterval(pomodoroInterval);
        pausado = true;
        document.getElementById("pararAlarme").style.display = "block";
        document.getElementById("pomodoroAlarm").play().catch(error => {
          console.error("Erro ao tocar alarme:", error);
        });
        document.querySelector(".pomodoro").classList.add("pausado");
        atualizarTempo();
        return;
      }
      atualizarTempo();
    }
  }, 1000);
}

// Função para pausar o Pomodoro
function pausarPomodoro() {
  if (!pausado) {
    pausado = true;
    clearInterval(pomodoroInterval);
    const tempoDecorrido = Math.floor((Date.now() - tempoInicio) / 1000);
    duracaoTotal = duracaoTotal - tempoDecorrido;
    document.querySelector(".pomodoro").classList.add("pausado");
    atualizarTempo();
  }
}

// Função para resetar o Pomodoro
function resetarPomodoro() {
  clearInterval(pomodoroInterval);
  pausado = true;
  const minutos = parseInt(document.getElementById("entradaMinutos").value) || 25;
  duracaoTotal = minutos * 60;
  tempoInicio = null;
  document.querySelector(".pomodoro").classList.add("pausado");
  atualizarTempo();
  document.getElementById("pararAlarme").style.display = "none";
  document.getElementById("pomodoroAlarm").pause();
  document.getElementById("pomodoroAlarm").currentTime = 0;
}

// Função para parar o alarme do Pomodoro
function pararAlarme() {
  document.getElementById("pomodoroAlarm").pause();
  document.getElementById("pomodoroAlarm").currentTime = 0;
  document.getElementById("pararAlarme").style.display = "none";
}

// Função para atualizar o tempo do Pomodoro
function atualizarTempo() {
  let minutos = 0;
  let segundos = 0;
  if (!pausado && tempoInicio !== null) {
    const tempoDecorrido = Math.floor((Date.now() - tempoInicio) / 1000);
    const tempoRestante = Math.max(0, duracaoTotal - tempoDecorrido);
    minutos = Math.floor(tempoRestante / 60);
    segundos = tempoRestante % 60;
  } else {
    minutos = Math.floor(duracaoTotal / 60);
    segundos = duracaoTotal % 60;
  }
  document.getElementById("tempo").textContent = `${minutos.toString().padStart(2, "0")}:${segundos.toString().padStart(2, "0")}`;
}

// Função para mostrar ajuda sobre tarefas recorrentes
function mostrarAjudaRecorrente() {
  alert("ℹ️ Tarefas Recorrentes:\nUma tarefa recorrente é automaticamente recriada após ser concluída. Se tiver um prazo, o novo prazo será o dia seguinte ao original. Útil para hábitos ou tarefas diárias, como 'Beber água' ou 'Estudar 1 hora'.");
}

// Autenticação com Firebase
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const loginModal = document.getElementById('loginModal');
const closeModal = document.getElementById('closeModal');
const emailLoginButton = document.getElementById('emailLoginButton');
const googleLoginButton = document.getElementById('googleLoginButton');
const registerButton = document.getElementById('registerButton');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const authError = document.getElementById('authError');

loginButton.onclick = () => loginModal.style.display = 'flex';
closeModal.onclick = () => {
  loginModal.style.display = 'none';
  authError.style.display = 'none';
};

emailLoginButton.onclick = () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      loginModal.style.display = 'none';
      authError.style.display = 'none';
      mostrarToast("✅ Login realizado com sucesso!");
    })
    .catch(err => {
      authError.textContent = err.message;
      authError.style.display = 'block';
    });
};

googleLoginButton.onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then(() => {
      loginModal.style.display = 'none';
      authError.style.display = 'none';
      mostrarToast("✅ Login com Google realizado!");
    })
    .catch(err => {
      authError.textContent = err.message;
      authError.style.display = 'block';
    });
};

registerButton.onclick = () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  auth.createUserWithEmailAndPassword(email, password)
    .then(() => {
      loginModal.style.display = 'none';
      authError.style.display = 'none';
      mostrarToast("✅ Conta criada com sucesso!");
    })
    .catch(err => {
      authError.textContent = err.message;
      authError.style.display = 'block';
    });
};

logoutButton.onclick = () => {
  auth.signOut().then(() => {
    mostrarToast("👋 Logout realizado!");
  });
};

auth.onAuthStateChanged(user => {
  if (user) {
    userInfo.style.display = 'inline';
    userName.textContent = user.displayName || user.email;
    loginButton.style.display = 'none';
    logoutButton.style.display = 'block';
    carregarTarefas();
  } else {
    userInfo.style.display = 'none';
    loginButton.style.display = 'block';
    logoutButton.style.display = 'none';
    tarefas = [];
    document.getElementById("listaTarefas").innerHTML = "";
    atualizarContador();
    atualizarGrafico();
    atualizarHistorico();
  }
});

// Inicialização
document.addEventListener("DOMContentLoaded", function() {
  console.log("Inicializando aplicação...");

  solicitarPermissaoNotificacoes();
  carregarTema();
  verificarPrazos();
  setInterval(verificarPrazos, 60000);

  document.getElementById("adicionarTarefa").addEventListener("click", adicionarTarefa);
  document.getElementById("iniciarPomodoro").addEventListener("click", iniciarPomodoro);
  document.getElementById("pausarPomodoro").addEventListener("click", pausarPomodoro);
  document.getElementById("resetarPomodoro").addEventListener("click", resetarPomodoro);
  document.getElementById("pararAlarme").addEventListener("click", pararAlarme);
  document.getElementById("exportarTXT").addEventListener("click", exportarTXT);
  document.getElementById("exportarPDF").addEventListener("click", exportarPDF);
  document.getElementById("exportarExcel").addEventListener("click", exportarExcel);
  document.getElementById("limparTudo").addEventListener("click", limparTudo);
  document.getElementById("alternarTema").addEventListener("click", alternarTema);
  document.getElementById("filtroCategoria").addEventListener("change", filtrarTarefas);
  document.getElementById("filtroStatus").addEventListener("change", filtrarTarefas);
  document.getElementById("ordenarTarefas").addEventListener("change", ordenarTarefas);
  document.getElementById("modoLista").addEventListener("click", () => alternarModoVisualizacao("lista"));
  document.getElementById("modoKanban").addEventListener("click", () => alternarModoVisualizacao("kanban"));
  document.getElementById("modoCalendario").addEventListener("click", () => alternarModoVisualizacao("calendario"));
  document.getElementById("ajudaRecorrente").addEventListener("click", (event) => {
    event.stopPropagation();
    mostrarAjudaRecorrente();
  });

  document.getElementById("entradaMinutos").addEventListener("change", () => {
    if (pausado && tempoInicio === null) {
      const minutos = parseInt(document.getElementById("entradaMinutos").value) || 25;
      duracaoTotal = minutos * 60;
      atualizarTempo();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !pausado && tempoInicio !== null) {
      atualizarTempo();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && document.activeElement === document.getElementById("novaTarefa")) {
      adicionarTarefa();
    }
    if (e.key === " " && !e.target.matches("input, select")) {
      e.preventDefault();
      if (pausado) {
        iniciarPomodoro();
      } else {
        pausarPomodoro();
      }
    }
    if (e.ctrlKey && e.shiftKey && e.key === "L") {
      limparTudo();
    }
  });

  document.getElementById("corPrimaria").addEventListener("input", (e) => {
    document.documentElement.style.setProperty("--primary", e.target.value);
    localStorage.setItem("corPrimaria", e.target.value);
  });

  document.getElementById("corFundo").addEventListener("input", (e) => {
    document.documentElement.style.setProperty("--background", e.target.value);
    localStorage.setItem("corFundo", e.target.value);
  });

  const corPrimariaSalva = localStorage.getItem("corPrimaria") || "#ff6347";
  const corFundoSalva = localStorage.getItem("corFundo") || "#1a1a1a";
  document.documentElement.style.setProperty("--primary", corPrimariaSalva);
  document.documentElement.style.setProperty("--background", corFundoSalva);
  document.getElementById("corPrimaria").value = corPrimariaSalva;
  document.getElementById("corFundo").value = corFundoSalva;

  console.log("somAdicionar carregado:", document.getElementById("somAdicionar").readyState === 4 ? "Sim" : "Não");
  console.log("somRemover carregado:", document.getElementById("somRemover").readyState === 4 ? "Sim" : "Não");

  atualizarGrafico();
  console.log("Inicialização concluída!");
});