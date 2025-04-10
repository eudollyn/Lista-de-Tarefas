// script.js

let chartInstance = null;

// ==== Toast ====
function mostrarToast(msg) {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.className = "toast show";
  setTimeout(() => toast.className = "toast", 3000);
}

// ==== Storage ====
function salvarTarefas() {
  const tarefas = [...document.querySelectorAll("#listaTarefas li")].map(li => {
    const span = li.querySelector("span");
    const texto = span?.childNodes[0].nodeValue.trim() || "";
    const categoria = span?.querySelector("small")?.innerText.match(/\[(.*)\]/)?.[1] || "Outros";
    const prazoMatch = span?.innerHTML.match(/⏰ (\d{4}-\d{2}-\d{2})/);
    const prazo = prazoMatch ? prazoMatch[1] : "";
    const feito = li.classList.contains("feito");
    const recorrente = li.dataset.recorrente === "true";
    return { texto, categoria, prazo, feito, recorrente };
  });
  localStorage.setItem("tarefas", JSON.stringify(tarefas));
}

function carregarTarefas() {
  const tarefas = JSON.parse(localStorage.getItem("tarefas")) || [];
  tarefas.forEach(({ texto, categoria, prazo, feito, recorrente }) => {
    const li = document.createElement("li");
    li.className = "animada";
    if (feito) li.classList.add("feito");
    li.dataset.recorrente = recorrente || false;
    const dataPrazo = prazo ? `<small class="prazo">⏰ ${prazo}</small>` : "";
    li.innerHTML = `
      <span class="${feito ? 'concluida' : ''}">${texto} <small>[${categoria}]</small> ${dataPrazo}</span>
      <button class="btn-check" onclick="concluirTarefa(this)">✔️</button>
      <button onclick="editarTarefa(this)">✏️</button>
      <button onclick="removerTarefa(this)">🗑️</button>
      <button onclick="reagendarTarefa(this)">📅</button>
    `;
    document.getElementById("listaTarefas").appendChild(li);
  });
  atualizarContador();
}

function limparLocalStorage() {
  localStorage.removeItem("tarefas");
}

function adicionarTarefa() {
  console.log("Função adicionarTarefa chamada");
  const inputTarefa = document.getElementById("novaTarefa");
  const categoria = document.getElementById("categoria").value;
  const prazo = document.getElementById("prazoTarefa").value;
  const recorrente = document.getElementById("tarefaRecorrente").checked;
  const texto = inputTarefa.value.trim();

  if (!texto) {
    alert("⚠️ Por favor, insira uma descrição para a tarefa!");
    return;
  }

  const li = document.createElement("li");
  li.className = "animada";
  li.dataset.recorrente = recorrente;
  li.innerHTML = `
    <span>${texto} <small>[${categoria}]</small> ${prazo ? `<small class="prazo">⏰ ${prazo}</small>` : ""}</span>
    <button class="btn-check" onclick="concluirTarefa(this)">✔️</button>
    <button onclick="editarTarefa(this)">✏️</button>
    <button onclick="removerTarefa(this)">🗑️</button>
    <button onclick="reagendarTarefa(this)">📅</button>
  `;
  
  document.getElementById("listaTarefas").appendChild(li);
  inputTarefa.value = "";
  document.getElementById("prazoTarefa").value = "";
  document.getElementById("tarefaRecorrente").checked = false;

  salvarTarefas();
  atualizarContador();
  atualizarGrafico();
  mostrarToast("✅ Tarefa adicionada com sucesso!");
  document.getElementById("somAdicionar").play();
}

function atualizarContador() {
  const total = document.querySelectorAll("#listaTarefas li").length;
  const pendentes = document.querySelectorAll("#listaTarefas li:not(.feito)").length;
  document.getElementById("total").innerText = `Total: ${total}`;
  document.getElementById("pendentes").innerText = `Pendentes: ${pendentes}`;
}

function concluirTarefa(btn) {
  const li = btn.parentElement;
  li.classList.toggle("feito");
  const span = li.querySelector("span");
  span.classList.toggle("concluida");

  if (li.classList.contains("feito") && li.dataset.recorrente === "true") {
    const texto = span.childNodes[0].nodeValue.trim();
    const categoria = span.querySelector("small").innerText.match(/\[(.*)\]/)?.[1] || "Outros";
    const prazoMatch = span.innerHTML.match(/⏰ (\d{4}-\d{2}-\d{2})/)?.[1];
    let novoPrazo = "";

    if (prazoMatch) {
      const prazo = new Date(prazoMatch);
      prazo.setDate(prazo.getDate() + 1);
      novoPrazo = prazo.toISOString().split("T")[0];
    }

    const novoLi = document.createElement("li");
    novoLi.className = "animada";
    novoLi.dataset.recorrente = "true";
    novoLi.innerHTML = `
      <span>${texto} <small>[${categoria}]</small> ${novoPrazo ? `<small class="prazo">⏰ ${novoPrazo}</small>` : ""}</span>
      <button class="btn-check" onclick="concluirTarefa(this)">✔️</button>
      <button onclick="editarTarefa(this)">✏️</button>
      <button onclick="removerTarefa(this)">🗑️</button>
      <button onclick="reagendarTarefa(this)">📅</button>
    `;
    document.getElementById("listaTarefas").appendChild(novoLi);
  }

  salvarTarefas();
  atualizarContador();
  atualizarGrafico();
  filtrarTarefas();
  ordenarTarefas();
}

function removerTarefa(btn) {
  const li = btn.parentElement;
  li.remove();
  salvarTarefas();
  atualizarContador();
  atualizarGrafico();
  document.getElementById("somRemover").play();
  filtrarTarefas();
  ordenarTarefas();
}

function reagendarTarefa(btn) {
  const li = btn.parentElement;
  const novoPrazo = prompt("Digite o novo prazo (formato: AAAA-MM-DD):");
  if (novoPrazo) {
    const prazoSpan = li.querySelector(".prazo") || document.createElement("small");
    prazoSpan.className = "prazo";
    prazoSpan.innerText = `⏰ ${novoPrazo}`;
    if (!li.querySelector(".prazo")) li.querySelector("span").appendChild(prazoSpan);
    salvarTarefas();
    atualizarGrafico();
    filtrarTarefas();
    ordenarTarefas();
  }
}

function editarTarefa(btn) {
  const li = btn.parentElement;
  const span = li.querySelector("span");
  const textoAtual = span.childNodes[0].nodeValue.trim();
  const categoriaAtual = span.querySelector("small").innerText.match(/\[(.*)\]/)?.[1] || "Outros";
  const prazoAtual = span.querySelector(".prazo")?.innerText.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";

  const novoTexto = prompt("Editar tarefa:", textoAtual);
  if (novoTexto === null || novoTexto.trim() === "") return;

  const novaCategoria = prompt("Nova categoria (Pessoal, Trabalho, Estudos, Outros):", categoriaAtual);
  const novoPrazo = prompt("Novo prazo (formato AAAA-MM-DD, deixe vazio para remover):", prazoAtual);

  span.childNodes[0].nodeValue = novoTexto + " ";
  span.querySelector("small").innerText = `[${novaCategoria || categoriaAtual}]`;
  if (novoPrazo) {
    const prazoSpan = span.querySelector(".prazo") || document.createElement("small");
    prazoSpan.className = "prazo";
    prazoSpan.innerText = `⏰ ${novoPrazo}`;
    if (!span.querySelector(".prazo")) span.appendChild(prazoSpan);
  } else {
    const prazoSpan = span.querySelector(".prazo");
    if (prazoSpan) prazoSpan.remove();
  }

  salvarTarefas();
  atualizarGrafico();
  filtrarTarefas();
  ordenarTarefas();
}

// ==== Pomodoro ====
let tempoInicial = 25 * 60;
let tempoRestante = tempoInicial;
let pomodoroInterval = null;
let alarmeInterval = null;

function atualizarTempo() {
  const minutos = String(Math.floor(tempoRestante / 60)).padStart(2, '0');
  const segundos = String(tempoRestante % 60).padStart(2, '0');
  document.getElementById("tempo").innerText = `${minutos}:${segundos}`;
}

function iniciarPomodoro() {
  const entrada = document.getElementById("entradaMinutos").value;
  const minutosDigitados = parseInt(entrada);

  if (isNaN(minutosDigitados) || minutosDigitados <= 0) {
    alert("⛔ Por favor, insira um tempo válido (mínimo 1 minuto).");
    return;
  }

  tempoInicial = minutosDigitados * 60;
  tempoRestante = tempoInicial;
  atualizarTempo();

  if (!pomodoroInterval) {
    pomodoroInterval = setInterval(() => {
      if (tempoRestante > 0) {
        tempoRestante--;
        atualizarTempo();
      } else {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
        iniciarAlarme();
      }
    }, 1000);
  }
}

function pausarPomodoro() {
  clearInterval(pomodoroInterval);
  pomodoroInterval = null;
}

function resetarPomodoro() {
  pausarPomodoro();
  tempoRestante = tempoInicial;
  atualizarTempo();
  pararAlarme();
}

function iniciarAlarme() {
  const alarme = document.getElementById("pomodoroAlarm");
  const pararAlarmeBtn = document.getElementById("pararAlarme");

  console.log("Tentando tocar o alarme...");
  alarme.load();
  const playPromise = alarme.play();

  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        console.log("Alarme tocando com sucesso!");
      })
      .catch(error => {
        console.error("Erro ao tocar o alarme:", error);
      });
  }

  pararAlarmeBtn.style.display = "inline-block";

  alarmeInterval = setInterval(() => {
    alarme.currentTime = 0;
    alarme.play().catch(error => {
      console.error("Erro ao repetir o alarme:", error);
    });
  }, 11000);

  setTimeout(() => {
    alert("✅ Tempo finalizado! Hora da pausa.");
  }, 500);
}

function pararAlarme() {
  const alarme = document.getElementById("pomodoroAlarm");
  const pararAlarmeBtn = document.getElementById("pararAlarme");

  alarme.pause();
  alarme.currentTime = 0;
  clearInterval(alarmeInterval);
  alarmeInterval = null;
  pararAlarmeBtn.style.display = "none";
  console.log("Alarme parado.");
}

// ==== Firebase ====
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_DOMINIO.firebaseapp.com",
  databaseURL: "https://SEU_DOMINIO.firebaseio.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_BUCKET",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

function initFirebase() {
  firebase.initializeApp(firebaseConfig);
  return firebase.database();
}

// ==== Notificações ====
function solicitarPermissaoNotificacoes() {
  if ("Notification" in window) {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification("🔔 Notificações ativadas!");
      }
    });
  }
}

function notificarPomodoroFinalizado() {
  if ("Notification" in window) {
    new Notification("✅ Pomodoro finalizado! Faça uma pausa.");
  }
}

function verificarPrazos() {
  const tarefas = document.querySelectorAll("#listaTarefas li");
  const hoje = new Date();
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);

  tarefas.forEach(tarefa => {
    const prazoMatch = tarefa.querySelector(".prazo")?.innerText.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (!prazoMatch) return;

    const prazo = new Date(prazoMatch);
    const textoTarefa = tarefa.querySelector("span").childNodes[0].nodeValue.trim();
    const isFeito = tarefa.classList.contains("feito");

    if (isFeito) return;

    if (prazo < hoje) {
      new Notification(`🚨 Tarefa Vencida: ${textoTarefa}`, {
        body: `O prazo (${prazoMatch}) expirou!`,
      });
    } else if (prazo.toDateString() === amanha.toDateString()) {
      new Notification(`⏰ Prazo Próximo: ${textoTarefa}`, {
        body: `Esta tarefa vence amanhã (${prazoMatch})!`,
      });
    }
  });
}

// ==== Tema ====
function alternarTema() {
  console.log("Função alternarTema chamada");
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("tema", isDark ? "dark" : "light");
}

function carregarTema() {
  const temaSalvo = localStorage.getItem("tema");
  if (temaSalvo === "dark") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}

// ==== Funções Extras ====
function exportarTXT() {
  console.log("Função exportarTXT chamada");
  const tarefas = [...document.querySelectorAll("#listaTarefas li")].map(li => {
    const span = li.querySelector("span");
    const texto = span?.childNodes[0].nodeValue.trim() || "";
    const categoria = span?.querySelector("small")?.innerText.match(/\[(.*)\]/)?.[1] || "Outros";
    const prazoMatch = span?.innerHTML.match(/⏰ (\d{4}-\d{2}-\d{2})/);
    const prazo = prazoMatch ? prazoMatch[1] : "";
    const feito = li.classList.contains("feito");
    return `${feito ? "[Concluída]" : "[Pendente]"} ${texto} [${categoria}] ${prazo ? `⏰ ${prazo}` : ""}`;
  });

  if (tarefas.length === 0) {
    alert("⚠️ Nenhuma tarefa para exportar!");
    return;
  }

  const texto = tarefas.join("\n");
  const blob = new Blob([texto], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lista-de-tarefas.txt";
  a.click();
  URL.revokeObjectURL(url);
  mostrarToast("📄 Tarefas exportadas como TXT!");
}

function exportarPDF() {
  console.log("Função exportarPDF chamada");
  const tarefas = [...document.querySelectorAll("#listaTarefas li")].map(li => {
    const span = li.querySelector("span");
    const texto = span?.childNodes[0].nodeValue.trim() || "";
    const categoria = span?.querySelector("small")?.innerText.match(/\[(.*)\]/)?.[1] || "Outros";
    const prazoMatch = span?.innerHTML.match(/⏰ (\d{4}-\d{2}-\d{2})/);
    const prazo = prazoMatch ? prazoMatch[1] : "";
    const feito = li.classList.contains("feito");
    return `${feito ? "[Concluída]" : "[Pendente]"} ${texto} [${categoria}] ${prazo ? `⏰ ${prazo}` : ""}`;
  });

  if (tarefas.length === 0) {
    alert("⚠️ Nenhuma tarefa para exportar!");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Minha Lista de Tarefas", 10, 10);
  doc.setFontSize(12);
  tarefas.forEach((tarefa, index) => {
    doc.text(tarefa, 10, 20 + (index * 10));
  });
  doc.save("lista-de-tarefas.pdf");
  mostrarToast("📄 Tarefas exportadas como PDF!");
}

function limparTudo() {
  console.log("Função limparTudo chamada");
  if (!confirm("⚠️ Tem certeza que deseja limpar todas as tarefas? Essa ação não pode ser desfeita.")) {
    return;
  }

  const lista = document.getElementById("listaTarefas");
  lista.innerHTML = "";
  localStorage.removeItem("tarefas");
  atualizarContador();
  atualizarGrafico();
  mostrarToast("🗑️ Todas as tarefas foram removidas!");
}

function filtrarTarefas() {
  const filtro = document.getElementById("filtroCategoria").value;
  const tarefas = document.querySelectorAll("#listaTarefas li");

  tarefas.forEach(tarefa => {
    const categoria = tarefa.querySelector("span small").innerText.match(/\[(.*)\]/)?.[1] || "Outros";
    if (filtro === "todas" || categoria === filtro) {
      tarefa.style.display = "flex";
    } else {
      tarefa.style.display = "none";
    }
  });
}

function ordenarTarefas() {
  const criterio = document.getElementById("ordenarTarefas").value;
  const lista = document.getElementById("listaTarefas");
  const tarefas = Array.from(lista.children);

  if (criterio === "prazo") {
    tarefas.sort((a, b) => {
      const prazoA = a.querySelector(".prazo")?.innerText.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "9999-12-31";
      const prazoB = b.querySelector(".prazo")?.innerText.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "9999-12-31";
      return prazoA.localeCompare(prazoB);
    });
  }

  tarefas.forEach(tarefa => lista.appendChild(tarefa));
  filtrarTarefas();
}

function atualizarGrafico() {
  try {
    const tarefas = JSON.parse(localStorage.getItem("tarefas")) || [];
    const categorias = ["Pessoal", "Trabalho", "Estudos", "Outros"];
    const concluidasPorCategoria = categorias.map(cat => {
      return tarefas.filter(tarefa => tarefa.categoria === cat && tarefa.feito).length;
    });

    const ctx = document.getElementById("graficoTarefas").getContext("2d");

    if (chartInstance) {
      chartInstance.destroy();
    }

    // Obter as cores do tema atual
    const rootStyles = getComputedStyle(document.documentElement);
    const primaryColor = rootStyles.getPropertyValue('--primary').trim();
    const secondaryColor = rootStyles.getPropertyValue('--secondary').trim();
    const textColor = rootStyles.getPropertyValue('--text').trim();

    chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: categorias,
        datasets: [{
          label: "Tarefas Concluídas por Categoria",
          data: concluidasPorCategoria,
          backgroundColor: [
            primaryColor + "33", // 20% de opacidade (hex: 33)
            secondaryColor + "33",
            primaryColor + "66", // 40% de opacidade (hex: 66)
            secondaryColor + "66",
          ],
          borderColor: [
            primaryColor,
            secondaryColor,
            primaryColor,
            secondaryColor,
          ],
          borderWidth: 1,
        }],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              color: textColor, // Cor dos rótulos do eixo Y
            },
          },
          x: {
            ticks: {
              color: textColor, // Cor dos rótulos do eixo X
            },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: textColor, // Cor da legenda
            },
          },
        },
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar o gráfico:", error);
  }
}

function mostrarAjudaRecorrente() {
  alert("ℹ️ Tarefas Recorrentes:\nUma tarefa recorrente é automaticamente recriada após ser concluída. Se tiver um prazo, o novo prazo será o dia seguinte ao original. Útil para hábitos ou tarefas diárias, como 'Beber água' ou 'Estudar 1 hora'.");
}

// ==== Inicialização ====
window.onload = function() {
  carregarTarefas();
  solicitarPermissaoNotificacoes();
  mostrarToast("🎉 Bem-vindo à sua lista de tarefas!");

  // Carregar o tema salvo
  carregarTema();

  // Verificar prazos imediatamente
  verificarPrazos();
  setInterval(verificarPrazos, 60000);

  // Associar eventos aos botões
  document.getElementById("adicionarTarefa").addEventListener("click", adicionarTarefa);
  document.getElementById("iniciarPomodoro").addEventListener("click", iniciarPomodoro);
  document.getElementById("pausarPomodoro").addEventListener("click", pausarPomodoro);
  document.getElementById("resetarPomodoro").addEventListener("click", resetarPomodoro);
  document.getElementById("alternarTema").addEventListener("click", alternarTema);
  document.getElementById("pararAlarme").addEventListener("click", pararAlarme);
  document.getElementById("exportarTXT").addEventListener("click", exportarTXT);
  document.getElementById("exportarPDF").addEventListener("click", exportarPDF);
  document.getElementById("limparTudo").addEventListener("click", limparTudo);
  document.getElementById("filtroCategoria").addEventListener("change", filtrarTarefas);
  document.getElementById("ordenarTarefas").addEventListener("change", ordenarTarefas);
  document.getElementById("ajudaRecorrente").addEventListener("click", mostrarAjudaRecorrente);

  // Chamar atualizarGrafico para criar o gráfico ao carregar a página
  atualizarGrafico();

  console.log("window.onload executado com sucesso!");
};

initFirebase();
atualizarTempo();