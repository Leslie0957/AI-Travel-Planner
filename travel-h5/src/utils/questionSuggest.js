export function createSuggestedQuestions(plan, messages = []) {
  const city = plan?.city || '当地'
  const days = Number(plan?.days || 0)
  const budget = Number(plan?.totalBudget || 0)
  const userMessages = messages.filter((message) => message.role === 'user').map((message) => message.content || '')
  const recentUserText = userMessages.slice(-3).join(' ')
  const askedText = userMessages.join(' ')
  const askedCategories = getQuestionCategories(askedText)

  const questions = []

  if (plan) {
    questions.push(createCandidate('pace', `这份${city}${days || ''}天行程会不会太赶？`))

    if (budget > 0) {
      questions.push(createCandidate('budget', `${budget}元预算够不够，还能怎么压缩？`))
    }

    questions.push(createCandidate('food', `${city}有哪些值得顺路吃的美食？`))

    if (days >= 4) {
      questions.push(createCandidate('route', `这份${days}天行程哪几天可以合并或删减？`))
    } else {
      questions.push(createCandidate('choice', `如果只保留${city}最经典景点，怎么取舍？`))
    }

    questions.push(createCandidate('stay', `${city}住在哪个区域会更方便？`))
    questions.push(createCandidate('booking', '哪些景点需要提前预约或避开高峰？'))
  } else {
    questions.push(createCandidate('route', '第一次去一个城市，应该怎么规划路线？'))
    questions.push(createCandidate('budget', '预算有限时，住宿和餐饮怎么分配？'))
    questions.push(createCandidate('pace', '如何判断一份旅行路线会不会太赶？'))
    questions.push(createCandidate('stay', '第一次去一个城市，住宿区域怎么选？'))
    questions.push(createCandidate('booking', '出发前需要提前确认哪些信息？'))
  }

  if (/预算|钱|贵|省|压缩/.test(recentUserText)) {
    questions.unshift(createCandidate('saving', '住宿、餐饮和门票分别有哪些省钱办法？'))
  }

  if (/路线|交通|赶|远/.test(recentUserText)) {
    questions.unshift(createCandidate('route', '能不能按区域重新优化这条路线？'))
  }

  if (/美食|吃|餐厅/.test(recentUserText)) {
    questions.unshift(createCandidate('food', `${city}有哪些本地小吃适合顺路安排？`))
  }

  return uniqueCandidates(questions)
    .filter((question) => !hasAskedSimilarQuestion(question, userMessages, askedCategories))
    .map((question) => question.text)
    .slice(0, 4)
}

function createCandidate(category, text) {
  return { category, text }
}

function uniqueCandidates(items) {
  const seen = new Set()

  return items.filter((item) => {
    if (!item?.text) return false

    const key = normalizeText(item.text)
    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

function hasAskedSimilarQuestion(question, userMessages, askedCategories) {
  const normalizedQuestion = normalizeText(question.text)

  if (userMessages.some((message) => normalizeText(message).includes(normalizedQuestion))) {
    return true
  }

  return askedCategories.has(question.category)
}

function getQuestionCategories(text) {
  const categories = new Set()

  if (/预算|钱|贵|省|压缩|够不够|够吗|够么|花费|费用/.test(text)) {
    categories.add('budget')
    categories.add('saving')
  }

  if (/路线|交通|区域|顺路|合并|删减|优化/.test(text)) {
    categories.add('route')
  }

  if (/赶|太赶|累|节奏|强度/.test(text)) {
    categories.add('pace')
  }

  if (/美食|吃|餐厅|小吃|夜市/.test(text)) {
    categories.add('food')
  }

  if (/取舍|保留|经典|值得|删掉|不去/.test(text)) {
    categories.add('choice')
  }

  if (/住宿|酒店|民宿|住哪|住在/.test(text)) {
    categories.add('stay')
  }

  if (/预约|门票|开放|高峰|排队|闭馆/.test(text)) {
    categories.add('booking')
  }

  return categories
}

function normalizeText(text) {
  return String(text || '').replace(/[，。！？、,.!?？\s]/g, '')
}
