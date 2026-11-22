// ========================================
// 1. ĐỌC DỮ LIỆU JSON
// ========================================

let students = [];
let subjects = [];
let grades = [];

async function loadData() {
  try {
    const [studentResponse, subjectResponse, gradeResponse] =
      await Promise.all([
        fetch("data/students.json"),
        fetch("data/subjects.json"),
        fetch("data/grades.json")
      ]);

    if (!studentResponse.ok ||
        !subjectResponse.ok ||
        !gradeResponse.ok) {
      throw new Error("Không tải được JSON");
    }

    students = await studentResponse.json();
    subjects = await subjectResponse.json();
    grades = await gradeResponse.json();

    const savedGrades = localStorage.getItem("studentGrades");

    if (savedGrades) {
      grades = JSON.parse(savedGrades);
    }

    return true;
  } catch (error) {
    console.error(error);

    document.body.insertAdjacentHTML(
      "afterbegin",
      `<p class="error">
        Không tải được dữ liệu. Hãy kiểm tra các file JSON.
      </p>`
    );

    return false;
  }
}

function getStudentScores(studentId) {
  const record = grades.find(
    item => item.studentId === studentId
  );

  return record ? record.scores : [];
}


// ========================================
// 2. TÍNH ĐIỂM TRUNG BÌNH
// ========================================

function calculateSubjectAverage(scores) {
  const [attendance, midterm, finalExam] = scores;

  return Number(
    (attendance * 0.1 + midterm * 0.4 + finalExam * 0.5)
      .toFixed(2)
  );
}

function calculateSemesterAverage(subjectAverages) {
  if (!subjectAverages.length) return 0;

  const total = subjectAverages.reduce(
    (sum, score) => sum + score, 0
  );

  return Number(
    (total / subjectAverages.length).toFixed(2)
  );
}


// ========================================
// 3. XẾP LOẠI
// ========================================

function classifyStudent(average) {
  if (average >= 8.5) return "Giỏi";
  if (average >= 7.0) return "Khá";
  if (average >= 5.0) return "Trung bình";
  return "Yếu";
}


// ========================================
// 4. HỌC BỔNG CƠ BẢN
// ========================================

function calculateBasicScholarship(average) {
  if (average >= 8.5) return 1500000;
  if (average >= 8.0) return 1000000;
  return 0;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " VNĐ";
}


// ========================================
// 5. TẠO KẾT QUẢ SINH VIÊN
// ========================================

function getStudentResults() {
  return students.map(student => {
    const scores = getStudentScores(student.id);

    const subjectAverages = scores.map(
      score => calculateSubjectAverage(score)
    );

    const semesterAverage =
      calculateSemesterAverage(subjectAverages);

    return {
      ...student,
      scores,
      subjectAverages,
      semesterAverage,
      classification: classifyStudent(semesterAverage),
      basicScholarship: calculateBasicScholarship(semesterAverage),
      rank: 0,
      scholarshipGroup: "Không thuộc nhóm",
      fundScholarship: 0
    };
  });
}


// ========================================
// 6. PHÂN BỔ QUỸ HỌC BỔNG 100 TRIỆU
// ========================================

function calculateScholarships(results) {
  const ranked = [...results].sort((a, b) => {
    if (b.semesterAverage !== a.semesterAverage) {
      return b.semesterAverage - a.semesterAverage;
    }

    return a.id.localeCompare(b.id);
  });

  const total = ranked.length;

  const top10 = Math.ceil(total * 0.10);
  const top30 = Math.ceil(total * 0.30);
  const top50 = Math.ceil(total * 0.50);

  const groups = [
    {
      name: "Top 10%",
      start: 0,
      end: top10,
      fund: 40000000
    },
    {
      name: "Top 30%",
      start: top10,
      end: top30,
      fund: 40000000
    },
    {
      name: "Top 50%",
      start: top30,
      end: top50,
      fund: 20000000
    }
  ];

  ranked.forEach((student, index) => {
    student.rank = index + 1;
    student.scholarshipGroup = "Không thuộc nhóm";
    student.fundScholarship = 0;
  });

  groups.forEach(group => {
    const members = ranked.slice(group.start, group.end);

    if (members.length === 0) return;

    const base = Math.floor(
      group.fund / members.length / 1000
    ) * 1000;

    const remainder = group.fund - base * members.length;
    const bonusCount = remainder / 1000;

    members.forEach((student, index) => {
      student.scholarshipGroup = group.name;

      student.fundScholarship =
        base + (index < bonusCount ? 1000 : 0);
    });
  });

  return ranked;
}


// ========================================
// 7. SẮP XẾP TÊN TIẾNG VIỆT
// ========================================

const viCollator = new Intl.Collator("vi", {
  sensitivity: "base"
});

function sortVietnameseNames(list) {
  return [...list].sort((a, b) => {
    const partsA = a.name.trim().split(/\s+/);
    const partsB = b.name.trim().split(/\s+/);

    const givenA = partsA.pop();
    const givenB = partsB.pop();

    const compareGiven = viCollator.compare(givenA, givenB);

    if (compareGiven !== 0) return compareGiven;

    const compareRemaining = viCollator.compare(
      partsA.join(" "),
      partsB.join(" ")
    );

    if (compareRemaining !== 0) return compareRemaining;

    return a.id.localeCompare(b.id);
  });
}


// ========================================
// 8. TRANG CHỦ
// ========================================

let sortedByName = false;

function updateDashboard(results) {
  document.getElementById("totalStudents").textContent =
    results.length;

  const average = results.length
    ? results.reduce(
        (sum, student) => sum + student.semesterAverage, 0
      ) / results.length
    : 0;

  document.getElementById("classAverage").textContent =
    average.toFixed(2);

  document.getElementById("excellentCount").textContent =
    results.filter(s => s.classification === "Giỏi").length;

  const totalScholarship = results.reduce(
    (sum, student) => sum + student.basicScholarship, 0
  );

  document.getElementById("totalScholarship").textContent =
    formatCurrency(totalScholarship);
}

function renderStudentTable(results) {
  const tbody = document.getElementById("studentTable");

  tbody.innerHTML = results.map(student => {
    const badgeClass =
      student.classification === "Trung bình"
        ? "Trung-bình"
        : student.classification;

    return `
      <tr>
        <td>${student.rank}</td>
        <td>${student.id}</td>
        <td>${student.name}</td>
        <td>${student.class}</td>
        <td>${student.semesterAverage.toFixed(2)}</td>
        <td>
          <span class="badge ${badgeClass}">
            ${student.classification}
          </span>
        </td>
        <td>${formatCurrency(student.basicScholarship)}</td>
        <td>${student.scholarshipGroup}</td>
        <td>${formatCurrency(student.fundScholarship)}</td>
        <td>
          <button class="detail-button" data-id="${student.id}">
            Xem
          </button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".detail-button").forEach(button => {
    button.addEventListener("click", () => {
      showStudentDetail(button.dataset.id);
    });
  });
}

function refreshHome() {
  const results = calculateScholarships(getStudentResults());

  updateDashboard(results);

  const search = document.getElementById("searchInput")
    .value.trim().toLowerCase();

  let filtered = results.filter(student =>
    student.id.toLowerCase().includes(search) ||
    student.name.toLowerCase().includes(search)
  );

  if (sortedByName) {
    filtered = sortVietnameseNames(filtered);
  }

  renderStudentTable(filtered);
}

function showStudentDetail(studentId) {
  const student = getStudentResults().find(
    item => item.id === studentId
  );

  if (!student) return;

  document.getElementById("detailStudentName").textContent =
    `${student.id} - ${student.name}`;

  document.getElementById("detailTable").innerHTML =
    student.scores.map((score, index) => `
      <tr>
        <td>${subjects[index].name}</td>
        <td>${score[0]}</td>
        <td>${score[1]}</td>
        <td>${score[2]}</td>
        <td>${student.subjectAverages[index].toFixed(2)}</td>
      </tr>
    `).join("");
}


// ========================================
// 9. CHỈNH SỬA ĐIỂM
// ========================================

function fillEditOptions() {
  const studentSelect = document.getElementById("editStudentId");
  const subjectSelect = document.getElementById("editSubject");

  studentSelect.innerHTML = students.map(student => `
    <option value="${student.id}">
      ${student.id} - ${student.name}
    </option>
  `).join("");

  subjectSelect.innerHTML = subjects.map((subject, index) => `
    <option value="${index}">${subject.name}</option>
  `).join("");

  loadSelectedGrade();
}

function loadSelectedGrade() {
  const studentId = document.getElementById("editStudentId").value;

  const subjectIndex = Number(
    document.getElementById("editSubject").value
  );

  if (!studentId || isNaN(subjectIndex)) return;

  const scores = getStudentScores(studentId)[subjectIndex];

  if (!scores) return;

  document.getElementById("attendance").value = scores[0];
  document.getElementById("midterm").value = scores[1];
  document.getElementById("finalExam").value = scores[2];
}

function handleGradeSubmit(event) {
  event.preventDefault();

  const studentId = document.getElementById("editStudentId").value;

  const subjectIndex = Number(
    document.getElementById("editSubject").value
  );

  const scores = [
    Number(document.getElementById("attendance").value),
    Number(document.getElementById("midterm").value),
    Number(document.getElementById("finalExam").value)
  ];

  if (!scores.every(score =>
    Number.isFinite(score) && score >= 0 && score <= 10
  )) {
    document.getElementById("editMessage").textContent =
      "Điểm phải từ 0 đến 10.";

    return;
  }

  const record = grades.find(
    item => item.studentId === studentId
  );

  if (!record) return;

  record.scores[subjectIndex] = scores;

  localStorage.setItem("studentGrades", JSON.stringify(grades));

  document.getElementById("editMessage").textContent =
    "Cập nhật điểm thành công.";

  refreshHome();
  showStudentDetail(studentId);
}


// ========================================
// 10. THỐNG KÊ
// ========================================

function renderHighestAverage(results) {
  const highest = Math.max(
    ...results.map(student => student.semesterAverage)
  );

  const topStudents = results.filter(
    student => student.semesterAverage === highest
  );

  document.getElementById("highestAverage").innerHTML = `
    <p>Điểm trung bình cao nhất:
      <strong>${highest.toFixed(2)}</strong>
    </p>
    <ul>
      ${topStudents.map(student =>
        `<li>${student.id} - ${student.name}</li>`
      ).join("")}
    </ul>
  `;
}

function renderClassificationStatistics(results) {
  const types = ["Giỏi", "Khá", "Trung bình", "Yếu"];

  document.getElementById("classificationTable").innerHTML =
    types.map(type => {
      const count = results.filter(
        student => student.classification === type
      ).length;

      return `
        <tr>
          <td>${type}</td>
          <td>${count}</td>
        </tr>
      `;
    }).join("");
}

function renderBelowFive(results) {
  const list = results.filter(student =>
    student.subjectAverages.some(score => score < 5)
  );

  document.getElementById("belowFiveTable").innerHTML =
    list.map(student => {
      const belowSubjects = student.subjectAverages
        .map((score, index) =>
          score < 5 ? subjects[index].name : null
        )
        .filter(Boolean);

      return `
        <tr>
          <td>${student.id}</td>
          <td>${student.name}</td>
          <td>${belowSubjects.join(", ")}</td>
        </tr>
      `;
    }).join("");
}

function renderSubjectStatistics(results) {
  document.getElementById("subjectStatistics").innerHTML =
    subjects.map((subject, index) => {
      const scores = results.map(
        student => student.subjectAverages[index]
      );

      const average = scores.reduce(
        (sum, score) => sum + score, 0
      ) / scores.length;

      return `
        <tr>
          <td>${subject.name}</td>
          <td>${average.toFixed(2)}</td>
          <td>${Math.min(...scores).toFixed(2)}</td>
          <td>${Math.max(...scores).toFixed(2)}</td>
        </tr>
      `;
    }).join("");
}

function initStatistics(results) {
  renderHighestAverage(results);
  renderClassificationStatistics(results);
  renderBelowFive(results);
  renderSubjectStatistics(results);
}


// ========================================
// 11. SO SÁNH SINH VIÊN
// ========================================

function fillComparisonOptions() {
  const options = students.map(student => `
    <option value="${student.id}">
      ${student.id} - ${student.name}
    </option>
  `).join("");

  document.getElementById("student1").innerHTML = options;
  document.getElementById("student2").innerHTML = options;

  if (students.length > 1) {
    document.getElementById("student2").value = students[1].id;
  }
}

function compareStudents() {
  const id1 = document.getElementById("student1").value;
  const id2 = document.getElementById("student2").value;

  const message = document.getElementById("comparisonMessage");
  const tbody = document.getElementById("comparisonTable");

  if (id1 === id2) {
    message.textContent = "Hãy chọn hai sinh viên khác nhau.";
    tbody.innerHTML = "";
    return;
  }

  message.textContent = "";

  const results = getStudentResults();

  const student1 = results.find(student => student.id === id1);
  const student2 = results.find(student => student.id === id2);

  if (!student1 || !student2) return;

  document.getElementById("student1Name").textContent =
    `${student1.id} - ${student1.name}`;

  document.getElementById("student2Name").textContent =
    `${student2.id} - ${student2.name}`;

  const rows = subjects.map((subject, index) => ({
    name: subject.name,
    score1: student1.subjectAverages[index],
    score2: student2.subjectAverages[index]
  }));

  rows.push({
    name: "Điểm trung bình học kỳ",
    score1: student1.semesterAverage,
    score2: student2.semesterAverage
  });

  tbody.innerHTML = rows.map(row => {
    const difference = row.score1 - row.score2;

    return `
      <tr>
        <td>${row.name}</td>
        <td>${row.score1.toFixed(2)}</td>
        <td>${row.score2.toFixed(2)}</td>
        <td>${difference > 0 ? "+" : ""}${difference.toFixed(2)}</td>
      </tr>
    `;
  }).join("");
}


// ========================================
// 12. KHỞI ĐỘNG
// ========================================

async function startApp() {
  const loaded = await loadData();

  if (!loaded) return;

  const results = getStudentResults();
  const page = document.body.dataset.page;

  if (page === "home") {
    fillEditOptions();
    refreshHome();

    document.getElementById("searchInput")
      .addEventListener("input", refreshHome);

    document.getElementById("sortButton")
      .addEventListener("click", () => {
        sortedByName = !sortedByName;

        document.getElementById("sortButton").textContent =
          sortedByName
            ? "Hiển thị thứ tự ban đầu"
            : "Sắp xếp tên A - Z";

        refreshHome();
      });

    document.getElementById("editStudentId")
      .addEventListener("change", loadSelectedGrade);

    document.getElementById("editSubject")
      .addEventListener("change", loadSelectedGrade);

    document.getElementById("editStudent")
      .addEventListener("submit", handleGradeSubmit);
  }

  if (page === "statistics") {
    initStatistics(results);
  }

  if (page === "comparison") {
    fillComparisonOptions();

    document.getElementById("compareButton")
      .addEventListener("click", compareStudents);

    compareStudents();
  }
}

startApp();
