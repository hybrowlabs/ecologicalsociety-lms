import { call, createResource } from 'frappe-ui'
import { useStorage } from '@vueuse/core'
import { computed, reactive, ref } from 'vue'

const onboardings = reactive({})
const onboardingStatus = useStorage('onboardingStatus', {})

const minimize = ref(false)
const showHelpModal = ref(false)

export function useOnboarding(appName) {
  const user = window.frappe?.session?.user || 'Guest'

  if (!user || user === 'Guest') {
    return {
      steps: [],
      stepsCompleted: ref(0),
      totalSteps: ref(0),
      completedPercentage: ref(0),
      isOnboardingStepsCompleted: ref(false),
      updateOnboardingStep: () => {},
      skip: () => {},
      skipAll: () => {},
      reset: () => {},
      resetAll: () => {},
      setUp: () => {},
      syncStatus: () => {},
    }
  }

  const isOnboardingStepsCompleted = useStorage(
    'isOnboardingStepsCompleted' + appName + user,
    false,
  )

  const onboardingSteps = computed(
    () =>
      onboardingStatus.value?.[user]?.[appName + '_onboarding_status'] || [],
  )

  if (!onboardingSteps.value.length && !isOnboardingStepsCompleted.value) {
    createResource({
      url: 'frappe.onboarding.get_onboarding_status',
      cache: 'onboarding_status',
      auto: true,
      onSuccess: (data) => {
        if (!onboardingStatus.value[user]) {
          onboardingStatus.value[user] = {}
        }
        onboardingStatus.value[user] = data
        syncStatus()
      },
    })
  }

  const stepsCompleted = computed(
    () => onboardings[appName]?.filter((step) => step.completed).length || 0,
  )
  const totalSteps = computed(() => onboardings[appName]?.length || 0)

  const completedPercentage = computed(() =>
    Math.floor((stepsCompleted.value / totalSteps.value) * 100),
  )

  function skip(step, callback = null) {
    updateOnboardingStep(step, true, true, callback)
  }

  function skipAll(callback = null) {
    updateAll(true, callback)
  }

  function reset(step, callback = null) {
    updateOnboardingStep(step, false, false, callback)
  }

  function resetAll(callback = null) {
    updateAll(false, callback)
  }

  function updateOnboardingStep(
    step,
    value = true,
    skipped = false,
    callback = null,
  ) {
    if (isOnboardingStepsCompleted.value) return

    if (!onboardingSteps.value.length) {
      if (!onboardings[appName]) return
      if (!onboardingStatus.value[user]) {
        onboardingStatus.value[user] = {}
      }
      onboardingStatus.value[user][appName + '_onboarding_status'] =
        onboardings[appName].map((s) => {
          return { name: s.name, completed: false }
        })
    }

    let index = onboardingSteps.value.findIndex((s) => s.name === step)
    if (index !== -1) {
      if (onboardingSteps.value[index]) {
        onboardingSteps.value[index].completed = value
      }
      if (onboardings[appName] && onboardings[appName][index]) {
        onboardings[appName][index].completed = value
      }
    }

    updateUserOnboardingStatus(onboardingSteps.value)

    callback?.(step, skipped)

    minimize.value = false
  }

  function updateAll(value, callback = null) {
    if (isOnboardingStepsCompleted.value && value) return

    if (!onboardingSteps.value.length) {
      if (!onboardingStatus.value[user]) {
        onboardingStatus.value[user] = {}
      }

      if (!onboardings[appName]) return

      onboardingStatus.value[user][appName + '_onboarding_status'] =
        onboardings[appName].map((s) => {
          return { name: s.name, completed: value }
        })
    } else {
      onboardingSteps.value.forEach((step) => {
        step.completed = value
      })
    }

    if (onboardings[appName]) {
      onboardings[appName].forEach((step) => {
        step.completed = value
      })
    }

    updateUserOnboardingStatus(onboardingSteps.value)

    callback?.(value)
  }

  function updateUserOnboardingStatus(steps) {
    call('frappe.onboarding.update_user_onboarding_status', {
      steps: JSON.stringify(steps),
      appName,
    })
  }

  function syncStatus() {
    if (isOnboardingStepsCompleted.value) return

    if (onboardingSteps.value.length) {
      let _steps = onboardingSteps.value
      _steps.forEach((step, index) => {
        if (onboardings[appName] && onboardings[appName][index]) {
          onboardings[appName][index].completed = step.completed
        }
      })
      isOnboardingStepsCompleted.value = _steps.every((step) => step.completed)
    } else {
      isOnboardingStepsCompleted.value = false
    }
  }

  function setUp(steps) {
    showHelpModal.value = !isOnboardingStepsCompleted.value

    if (onboardings[appName]) return

    onboardings[appName] = steps
    syncStatus()
  }

  return {
    steps: onboardings[appName] || [],
    stepsCompleted,
    totalSteps,
    completedPercentage,
    isOnboardingStepsCompleted,
    updateOnboardingStep,
    skip,
    skipAll,
    reset,
    resetAll,
    setUp,
    syncStatus,
  }
}
