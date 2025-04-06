function mostrarPopupBoasVindas() {
  alert("🎉 Bem-vindo à sua lista de tarefas!");
}

function adicionarTarefa() {
  const texto = document.getElementById("novaTarefa").value.trim();
  const categoria = document.getElementById("categoria").value;
  if (!texto) return;

  const li = document.createElement("li");
  li.className = "animada";
  li.innerHTML = `
    <span>${texto} <small>[${categoria}]</small></span>
    <button class="btn-check" onclick="concluirTarefa(this)">✔️</button>
    <button onclick="removerTarefa(this)">🗑️</button>
  `;
  document.getElementById("listaTarefas").appendChild(li);
  document.getElementById("novaTarefa").value = "";
  mostrarToast("Tarefa adicionada!");
  document.getElementById("somAdicionar").play();
  salvarTarefas();
}

function concluirTarefa(botao) {
  const li = botao.parentElement;
  li.classList.toggle("feito");
  const tarefa = li.querySelector("span");
  tarefa.classList.toggle("concluida");
  mostrarToast("Tarefa marcada como concluída!");
  salvarTarefas();
}

function removerTarefa(btn) {
  btn.parentElement.remove();
  mostrarToast("Tarefa removida!");
  document.getElementById("somRemover").play();
  salvarTarefas();
}

function limparTudo() {
  document.getElementById("listaTarefas").innerHTML = "";
  mostrarToast("Todas as tarefas foram removidas.");
  limparLocalStorage();
  salvarTarefas();
}

function alternarTema() {
  document.body.classList.toggle("dark");
}

function exportarTXT() {
  const tarefas = [...document.querySelectorAll("#listaTarefas li span")].map(e => e.innerText);
  const blob = new Blob([tarefas.join("\n")], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "lista.txt";
  a.click();
}

function exportarPDF() {
  const tarefas = [...document.querySelectorAll("#listaTarefas li span")].map(e => e.innerText);
  const win = window.open();
  win.document.write(`<pre>${tarefas.join("\n")}</pre>`);
  win.print();
}

function mostrarToast(msg) {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.className = "toast show";
  setTimeout(() => toast.className = "toast", 3000);
}

// ====== CONTADOR DE TAREFAS ======
function atualizarContador() {
  const total = document.querySelectorAll("#listaTarefas li").length;
  const concluidas = document.querySelectorAll("#listaTarefas li.feito").length;
  const pendentes = total - concluidas;
  document.getElementById("total").innerText = `Total: ${total}`;
  document.getElementById("pendentes").innerText = `Pendentes: ${pendentes}`;
}

// Chamar após adicionar/remover tarefa
const lista = document.getElementById("listaTarefas");
const observer = new MutationObserver(atualizarContador);
observer.observe(lista, { childList: true, subtree: true });

// ====== POMODORO ======
let tempoInicial = 25 * 60;
let tempoRestante = tempoInicial;
let pomodoroInterval = null;

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

// Primeiro toca o som
document.getElementById("alert").play();

// Depois de 0.5s, mostra o alerta (permite o som sair primeiro)
setTimeout(() => {
  alert("✅ Tempo finalizado! Hora da pausa.");
}, 500);
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
}

atualizarTempo(); // Mostrar o tempo inicial

// ====== LOCAL STORAGE ======
function salvarTarefas() {
  const tarefas = [...document.querySelectorAll("#listaTarefas li")].map(li => {
    const texto = li.querySelector("span")?.innerText || "";
    const feito = li.classList.contains("feito");
    return { texto, feito };
  });
  localStorage.setItem("tarefas", JSON.stringify(tarefas));
}

function carregarTarefas() {
  const tarefas = JSON.parse(localStorage.getItem("tarefas")) || [];
  tarefas.forEach(({ texto, feito }) => {
    const [t, categoriaMatch] = texto.split(" [");
    const categoria = categoriaMatch?.replace("]", "") || "Outros";

    const li = document.createElement("li");
    li.className = "animada";
    if (feito) li.classList.add("feito");

    li.innerHTML = `
      <span class="${feito ? 'concluida' : ''}">${t} <small>[${categoria}]</small></span>
      <button class="btn-check" onclick="concluirTarefa(this)">✔️</button>
      <button onclick="removerTarefa(this)">🗑️</button>
    `;
    document.getElementById("listaTarefas").appendChild(li);
  });
  atualizarContador();
}

function limparLocalStorage() {
  localStorage.removeItem("tarefas");
}

// ====== CARREGAMENTO INICIAL ======
window.onload = () => {
  carregarTarefas();
  mostrarPopupBoasVindas();
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register("service-worker.js")
    .then(() => console.log("✅ Service Worker registrado com sucesso!"))
    .catch(err => console.error("Erro ao registrar Service Worker:", err));
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js")
    .then(() => console.log("✅ Service Worker registrado!"))
    .catch(err => console.error("❌ Falha ao registrar o Service Worker:", err));
}

